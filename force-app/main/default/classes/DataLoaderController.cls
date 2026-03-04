/**
 * @description Controller for Data Loader module
 *              Handles bulk Insert, Update, and Upsert DML operations
 *              with CRUD/FLS enforcement via SecurityUtil and partial success handling.
 *              Client batches at max 200 records per call to stay within governor limits.
 * @group Controllers
 */
public with sharing class DataLoaderController {

    /**
     * Insert records from parsed CSV/clipboard data
     * @param objectApiName Target object API name
     * @param fieldsJson JSON array of field API names
     * @param dataJson JSON 2D array of string values (rows x columns)
     * @return DMLResult with per-row success/failure status
     */
    @AuraEnabled
    public static DMLResult insertRecords(String objectApiName, String fieldsJson, String dataJson) {
        if (!SecurityUtil.hasPowerToolsPermission()) {
            throw new AuraHandledException('Insufficient permissions. Dev Tools Power permission is required.');
        }
        Schema.SObjectType objType = SecurityUtil.validateObjectName(objectApiName);

        try {
            SecurityUtil.checkObjectCRUD(objType, SecurityUtil.CRUDOperation.CREATEABLE);
        } catch (SecurityUtil.SecurityException e) {
            throw new AuraHandledException(e.getMessage());
        }

        List<String> fieldNames = (List<String>) JSON.deserialize(fieldsJson, List<String>.class);
        List<String> accessibleFields = SecurityUtil.getAccessibleFields(objType, fieldNames, SecurityUtil.CRUDOperation.CREATEABLE);

        List<List<String>> dataRows = (List<List<String>>) JSON.deserialize(dataJson, List<List<String>>.class);

        if (dataRows.isEmpty()) {
            DMLResult emptyResult = new DMLResult();
            return emptyResult;
        }

        List<SObject> records = buildRecords(objType, accessibleFields, dataRows);
        records = Security.stripInaccessible(AccessType.CREATABLE, records).getRecords();
        Database.SaveResult[] results = Database.insert(records, false);

        return buildDMLResult(results, records);
    }

    /**
     * Update existing records by Id
     * @param objectApiName Target object API name
     * @param fieldsJson JSON array of field API names (must include Id)
     * @param dataJson JSON 2D array of string values (rows x columns)
     * @return DMLResult with per-row success/failure status
     */
    @AuraEnabled
    public static DMLResult updateRecords(String objectApiName, String fieldsJson, String dataJson) {
        if (!SecurityUtil.hasPowerToolsPermission()) {
            throw new AuraHandledException('Insufficient permissions. Dev Tools Power permission is required.');
        }
        Schema.SObjectType objType = SecurityUtil.validateObjectName(objectApiName);

        try {
            SecurityUtil.checkObjectCRUD(objType, SecurityUtil.CRUDOperation.UPDATEABLE);
        } catch (SecurityUtil.SecurityException e) {
            throw new AuraHandledException(e.getMessage());
        }

        List<String> fieldNames = (List<String>) JSON.deserialize(fieldsJson, List<String>.class);
        List<String> filteredFields = SecurityUtil.getAccessibleFields(objType, fieldNames, SecurityUtil.CRUDOperation.UPDATEABLE);

        // Rebuild accessible fields preserving original order, always including Id
        Set<String> filteredSet = new Set<String>();
        for (String f : filteredFields) {
            filteredSet.add(f.toLowerCase());
        }
        List<String> accessibleFields = new List<String>();
        for (String f : fieldNames) {
            if (f.equalsIgnoreCase('Id') || filteredSet.contains(f.toLowerCase())) {
                accessibleFields.add(f);
            }
        }

        List<List<String>> dataRows = (List<List<String>>) JSON.deserialize(dataJson, List<List<String>>.class);

        if (dataRows.isEmpty()) {
            DMLResult emptyResult = new DMLResult();
            return emptyResult;
        }

        List<SObject> records = buildRecords(objType, accessibleFields, dataRows);
        records = Security.stripInaccessible(AccessType.UPDATABLE, records).getRecords();
        Database.SaveResult[] results = Database.update(records, false);

        return buildDMLResult(results, records);
    }

    /**
     * Upsert records by external ID field
     * @param objectApiName Target object API name
     * @param externalIdField API name of the external ID field for matching
     * @param fieldsJson JSON array of field API names
     * @param dataJson JSON 2D array of string values (rows x columns)
     * @return DMLResult with per-row success/failure status
     */
    @AuraEnabled
    public static DMLResult upsertRecords(String objectApiName, String externalIdField, String fieldsJson, String dataJson) {
        if (!SecurityUtil.hasPowerToolsPermission()) {
            throw new AuraHandledException('Insufficient permissions. Dev Tools Power permission is required.');
        }
        Schema.SObjectType objType = SecurityUtil.validateObjectName(objectApiName);

        try {
            SecurityUtil.checkObjectCRUD(objType, SecurityUtil.CRUDOperation.CREATEABLE);
            SecurityUtil.checkObjectCRUD(objType, SecurityUtil.CRUDOperation.UPDATEABLE);
        } catch (SecurityUtil.SecurityException e) {
            throw new AuraHandledException(e.getMessage());
        }

        // Validate external ID field exists
        Schema.SObjectField extIdField = objType.getDescribe().fields.getMap().get(externalIdField.toLowerCase());
        if (extIdField == null) {
            throw new AuraHandledException('Invalid external ID field: ' + externalIdField);
        }

        List<String> fieldNames = (List<String>) JSON.deserialize(fieldsJson, List<String>.class);
        List<String> accessibleFields = SecurityUtil.getAccessibleFields(objType, fieldNames, SecurityUtil.CRUDOperation.CREATEABLE);

        List<List<String>> dataRows = (List<List<String>>) JSON.deserialize(dataJson, List<List<String>>.class);

        if (dataRows.isEmpty()) {
            DMLResult emptyResult = new DMLResult();
            return emptyResult;
        }

        List<SObject> records = buildRecords(objType, accessibleFields, dataRows);
        records = Security.stripInaccessible(AccessType.UPSERTABLE, records).getRecords();
        Database.UpsertResult[] results = Database.upsert(records, extIdField, false);

        return buildUpsertResult(results, records);
    }

    /**
     * Build SObject records from field names and data rows
     * @param objType The SObjectType
     * @param fieldNames Ordered list of field API names
     * @param dataRows 2D list of string values
     * @return List of populated SObjects
     */
    private static List<SObject> buildRecords(Schema.SObjectType objType, List<String> fieldNames, List<List<String>> dataRows) {
        List<SObject> records = new List<SObject>();
        // Pre-compute field map once instead of per-field-per-row
        Map<String, Schema.SObjectField> fieldMap = objType.getDescribe().fields.getMap();

        // Pre-cache DescribeFieldResult for each mapped field to avoid per-row getDescribe() calls
        Map<String, Schema.DescribeFieldResult> fieldDescribeCache = new Map<String, Schema.DescribeFieldResult>();
        for (String fn : fieldNames) {
            Schema.SObjectField sf = fieldMap.get(fn.toLowerCase());
            if (sf != null) {
                fieldDescribeCache.put(fn.toLowerCase(), sf.getDescribe());
            }
        }

        for (List<String> row : dataRows) {
            SObject rec = objType.newSObject();
            for (Integer i = 0; i < fieldNames.size() && i < row.size(); i++) {
                String fieldName = fieldNames[i];
                String rawValue = row[i];

                // Skip blank values
                if (String.isBlank(rawValue)) {
                    continue;
                }

                // Handle Id field specially
                if (fieldName.equalsIgnoreCase('Id')) {
                    rec.Id = rawValue.trim();
                } else {
                    Object castedValue = castValueCached(fieldName, rawValue, fieldDescribeCache);
                    if (castedValue != null) {
                        rec.put(fieldName, castedValue);
                    }
                }
            }
            records.add(rec);
        }

        return records;
    }

    /**
     * Cast a string value to the appropriate Apex type based on field metadata
     * @param fieldName The field API name
     * @param rawValue The raw string value
     * @param fieldMap Pre-computed field map for the target SObject
     * @return Typed Object value, or null on parse failure
     */
    private static Object castValue(String fieldName, String rawValue, Map<String, Schema.SObjectField> fieldMap) {
        Schema.SObjectField field = fieldMap.get(fieldName.toLowerCase());
        if (field == null) {
            return rawValue;
        }
        Schema.DescribeFieldResult fieldDescribe = field.getDescribe();
        return castWithDescribe(rawValue, fieldDescribe);
    }

    /**
     * Cast using pre-cached DescribeFieldResult (avoids per-row getDescribe calls)
     */
    private static Object castValueCached(String fieldName, String rawValue, Map<String, Schema.DescribeFieldResult> describeCache) {
        Schema.DescribeFieldResult fieldDescribe = describeCache.get(fieldName.toLowerCase());
        if (fieldDescribe == null) {
            return rawValue;
        }
        return castWithDescribe(rawValue, fieldDescribe);
    }

    private static Object castWithDescribe(String rawValue, Schema.DescribeFieldResult fieldDescribe) {
        Schema.DisplayType fieldType = fieldDescribe.getType();

        try {
            if (fieldType == Schema.DisplayType.STRING ||
                fieldType == Schema.DisplayType.TEXTAREA ||
                fieldType == Schema.DisplayType.EMAIL ||
                fieldType == Schema.DisplayType.PHONE ||
                fieldType == Schema.DisplayType.URL ||
                fieldType == Schema.DisplayType.PICKLIST ||
                fieldType == Schema.DisplayType.MULTIPICKLIST ||
                fieldType == Schema.DisplayType.ID ||
                fieldType == Schema.DisplayType.REFERENCE) {
                return rawValue;
            } else if (fieldType == Schema.DisplayType.INTEGER) {
                return Integer.valueOf(rawValue);
            } else if (fieldType == Schema.DisplayType.DOUBLE ||
                       fieldType == Schema.DisplayType.CURRENCY ||
                       fieldType == Schema.DisplayType.PERCENT) {
                return Decimal.valueOf(rawValue);
            } else if (fieldType == Schema.DisplayType.BOOLEAN) {
                return Boolean.valueOf(rawValue);
            } else if (fieldType == Schema.DisplayType.DATE) {
                return Date.valueOf(rawValue);
            } else if (fieldType == Schema.DisplayType.DATETIME) {
                return Datetime.valueOf(rawValue.replace('T', ' '));
            } else {
                return rawValue;
            }
        } catch (Exception e) {
            // Value casting failed - return null to skip this field silently
            return null;
        }
    }

    /**
     * Build DMLResult from Database.SaveResult array
     */
    private static DMLResult buildDMLResult(Database.SaveResult[] results, List<SObject> records) {
        DMLResult dmlResult = new DMLResult();
        dmlResult.totalRequested = results.size();

        for (Integer i = 0; i < results.size(); i++) {
            Database.SaveResult sr = results[i];
            RowResult row = new RowResult();
            row.rowIndex = i;
            row.success = sr.isSuccess();

            if (sr.isSuccess()) {
                row.recordId = sr.getId();
                dmlResult.successCount++;
            } else {
                row.errorMessage = sr.getErrors()[0].getMessage();
                dmlResult.failureCount++;
            }

            dmlResult.rows.add(row);
        }

        return dmlResult;
    }

    /**
     * Build DMLResult from Database.UpsertResult array
     */
    private static DMLResult buildUpsertResult(Database.UpsertResult[] results, List<SObject> records) {
        DMLResult dmlResult = new DMLResult();
        dmlResult.totalRequested = results.size();

        for (Integer i = 0; i < results.size(); i++) {
            Database.UpsertResult ur = results[i];
            RowResult row = new RowResult();
            row.rowIndex = i;
            row.success = ur.isSuccess();

            if (ur.isSuccess()) {
                row.recordId = ur.getId();
                dmlResult.successCount++;
            } else {
                row.errorMessage = ur.getErrors()[0].getMessage();
                dmlResult.failureCount++;
            }

            dmlResult.rows.add(row);
        }

        return dmlResult;
    }

    /**
     * Wrapper class for DML operation results
     */
    public class DMLResult {
        @AuraEnabled public Integer totalRequested = 0;
        @AuraEnabled public Integer successCount = 0;
        @AuraEnabled public Integer failureCount = 0;
        @AuraEnabled public List<RowResult> rows = new List<RowResult>();
    }

    /**
     * Wrapper class for per-row DML result
     */
    public class RowResult {
        @AuraEnabled public Integer rowIndex;
        @AuraEnabled public Boolean success;
        @AuraEnabled public String recordId;
        @AuraEnabled public String errorMessage;
    }
}
