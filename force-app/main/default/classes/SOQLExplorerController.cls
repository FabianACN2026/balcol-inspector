public with sharing class SOQLExplorerController {

    public class QueryResult {
        @AuraEnabled public List<SObject> records;
        @AuraEnabled public String objectName;
        @AuraEnabled public Integer totalSize;
        @AuraEnabled public List<ColumnInfo> columns;
        @AuraEnabled public Boolean hasMore;
        @AuraEnabled public Integer nextOffset;
        @AuraEnabled public String nextRecordsPath;
    }

    public class ColumnInfo {
        @AuraEnabled public String fieldName;
        @AuraEnabled public String label;
        @AuraEnabled public String type;
    }

    public class SOSLResult {
        @AuraEnabled public List<SOSLObjectGroup> objectGroups;
        @AuraEnabled public Integer totalRecords;
    }

    public class SOSLObjectGroup {
        @AuraEnabled public String objectApiName;
        @AuraEnabled public String objectLabel;
        @AuraEnabled public Integer recordCount;
        @AuraEnabled public List<SObject> records;
    }

    @AuraEnabled
    public static QueryResult executeQuery(String queryString) {
        if (!SecurityUtil.hasPowerToolsPermission()) {
            throw new AuraHandledException('Insufficient permissions: Power Tools access required');
        }
        if (String.isBlank(queryString)) {
            throw new AuraHandledException('Query string cannot be empty');
        }
        try {
            String objectName = extractObjectName(queryString);
            Schema.SObjectType objectType = SecurityUtil.validateObjectName(objectName);
            SecurityUtil.checkObjectCRUD(objectType, SecurityUtil.CRUDOperation.READ);

            List<SObject> records = Database.query(queryString);

            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.READABLE, records);
            List<SObject> safeRecords = decision.getRecords();

            QueryResult result = new QueryResult();
            result.records = safeRecords;
            result.objectName = objectName;
            result.totalSize = safeRecords.size();
            result.columns = buildColumns(objectType, safeRecords);
            return result;
        } catch (SecurityUtil.SecurityException e) {
            throw new AuraHandledException(e.getMessage());
        } catch (QueryException e) {
            throw new AuraHandledException('Query error: ' + e.getMessage());
        }
    }

    /**
     * Execute a SOQL query with pagination support.
     * Appends LIMIT/OFFSET if the user query doesn't already have them.
     * @param queryString The SOQL query
     * @param pageSize Number of records per page (default 200)
     * @param offset Starting offset (default 0)
     * @return QueryResult with hasMore flag and nextOffset
     */
    @AuraEnabled
    public static QueryResult executeQueryPaginated(String queryString, Integer pageSize, Integer offset) {
        if (!SecurityUtil.hasPowerToolsPermission()) {
            throw new AuraHandledException('Insufficient permissions: Power Tools access required');
        }
        if (String.isBlank(queryString)) {
            throw new AuraHandledException('Query string cannot be empty');
        }

        if (pageSize == null || pageSize <= 0) pageSize = 200;
        if (offset == null || offset < 0) offset = 0;

        try {
            String objectName = extractObjectName(queryString);
            Schema.SObjectType objectType = SecurityUtil.validateObjectName(objectName);
            SecurityUtil.checkObjectCRUD(objectType, SecurityUtil.CRUDOperation.READ);

            // Check if user already specified LIMIT/OFFSET
            String normalized = queryString.trim().replaceAll('\\s+', ' ');
            Boolean hasLimit = Pattern.compile('(?i)\\bLIMIT\\b').matcher(normalized).find();
            Boolean hasOffset = Pattern.compile('(?i)\\bOFFSET\\b').matcher(normalized).find();

            String paginatedQuery = queryString;
            if (!hasLimit && !hasOffset) {
                // Request one extra record to detect hasMore
                paginatedQuery = queryString + ' LIMIT ' + (pageSize + 1) + ' OFFSET ' + offset;
            }

            List<SObject> records = Database.query(paginatedQuery);
            SObjectAccessDecision decision = Security.stripInaccessible(AccessType.READABLE, records);
            List<SObject> safeRecords = decision.getRecords();

            QueryResult result = new QueryResult();
            result.objectName = objectName;

            if (!hasLimit && !hasOffset && safeRecords.size() > pageSize) {
                // More records available — trim to pageSize
                result.hasMore = true;
                result.nextOffset = offset + pageSize;
                List<SObject> trimmed = new List<SObject>();
                for (Integer i = 0; i < pageSize; i++) {
                    trimmed.add(safeRecords[i]);
                }
                result.records = trimmed;
            } else {
                result.hasMore = false;
                result.nextOffset = null;
                result.records = safeRecords;
            }

            result.totalSize = result.records.size();
            result.columns = buildColumns(objectType, result.records);
            return result;
        } catch (SecurityUtil.SecurityException e) {
            throw new AuraHandledException(e.getMessage());
        } catch (QueryException e) {
            throw new AuraHandledException('Query error: ' + e.getMessage());
        }
    }

    /**
     * Execute a SOQL query using REST API cursor pagination.
     * No OFFSET limit — uses Salesforce queryMore for unlimited paging.
     * @param queryString The SOQL query (used on first call only)
     * @param nextRecordsPath The nextRecordsUrl from a previous response (null on first call)
     * @param batchSize Records per page (default 200, max 2000)
     */
    @AuraEnabled
    public static QueryResult executeQueryCursor(String queryString, String nextRecordsPath, Integer batchSize) {
        if (!SecurityUtil.hasPowerToolsPermission()) {
            throw new AuraHandledException('Insufficient permissions: Power Tools access required');
        }

        if (batchSize == null || batchSize <= 0) batchSize = 200;
        if (batchSize > 2000) batchSize = 2000;

        try {
            String path;
            String objectName = null;

            if (String.isNotBlank(nextRecordsPath)) {
                path = nextRecordsPath;
            } else {
                if (String.isBlank(queryString)) {
                    throw new AuraHandledException('Query string cannot be empty');
                }
                objectName = extractObjectName(queryString);
                Schema.SObjectType objectType = SecurityUtil.validateObjectName(objectName);
                SecurityUtil.checkObjectCRUD(objectType, SecurityUtil.CRUDOperation.READ);
                path = '/services/data/v65.0/query?q=' + EncodingUtil.urlEncode(queryString, 'UTF-8');
            }

            HttpRequest req = SelfOrgCalloutHelper.createRequest(path, 'GET');
            req.setHeader('Sforce-Query-Options', 'batchSize=' + batchSize);
            req.setTimeout(120000);
            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() != 200) {
                throw new AuraHandledException('Query error: ' + res.getBody());
            }

            Map<String, Object> jsonResponse = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

            QueryResult result = new QueryResult();
            result.totalSize = (Integer) jsonResponse.get('totalSize');
            result.hasMore = !(Boolean) jsonResponse.get('done');
            result.nextRecordsPath = (String) jsonResponse.get('nextRecordsUrl');

            // Parse records — deserialize each back to SObject
            List<Object> rawRecords = (List<Object>) jsonResponse.get('records');
            List<SObject> records = new List<SObject>();

            if (rawRecords != null && !rawRecords.isEmpty()) {
                Map<String, Object> firstRaw = (Map<String, Object>) rawRecords[0];
                Map<String, Object> attrs = (Map<String, Object>) firstRaw.get('attributes');
                if (objectName == null && attrs != null) {
                    objectName = (String) attrs.get('type');
                }

                for (Object rawRecord : rawRecords) {
                    String recordJson = JSON.serialize(rawRecord);
                    SObject record = (SObject) JSON.deserialize(recordJson, SObject.class);
                    records.add(record);
                }
            }

            result.objectName = objectName;
            result.records = records;

            if (!records.isEmpty() && objectName != null) {
                Schema.SObjectType objType = Schema.getGlobalDescribe().get(objectName);
                if (objType != null) {
                    result.columns = buildColumns(objType, records);
                }
            }

            return result;
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Query error: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static SOSLResult executeSOSL(String soslString) {
        if (!SecurityUtil.hasPowerToolsPermission()) {
            throw new AuraHandledException('Insufficient permissions: Power Tools access required');
        }
        if (String.isBlank(soslString)) {
            throw new AuraHandledException('SOSL string cannot be empty');
        }
        try {
            List<List<SObject>> searchResults = Search.query(soslString);

            SOSLResult result = new SOSLResult();
            result.objectGroups = new List<SOSLObjectGroup>();
            result.totalRecords = 0;

            for (List<SObject> objRecords : searchResults) {
                if (!objRecords.isEmpty()) {
                    SOSLObjectGroup objGroup = new SOSLObjectGroup();
                    Schema.SObjectType objType = objRecords[0].getSObjectType();
                    Schema.DescribeSObjectResult describe = objType.getDescribe();
                    objGroup.objectApiName = describe.getName();
                    objGroup.objectLabel = describe.getLabel();

                    SObjectAccessDecision decision = Security.stripInaccessible(AccessType.READABLE, objRecords);
                    objGroup.records = decision.getRecords();
                    objGroup.recordCount = objGroup.records.size();
                    result.totalRecords += objGroup.recordCount;
                    result.objectGroups.add(objGroup);
                }
            }
            return result;
        } catch (Exception e) {
            throw new AuraHandledException('SOSL error: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static String createExportFile(String fileName, String fileContent) {
        if (!SecurityUtil.hasPowerToolsPermission()) {
            throw new AuraHandledException('Insufficient permissions');
        }
        try {
            ContentVersion cv = new ContentVersion();
            cv.Title = fileName;
            cv.PathOnClient = fileName;
            cv.VersionData = Blob.valueOf(fileContent);
            insert cv;

            cv = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id LIMIT 1];
            return cv.ContentDocumentId;
        } catch (Exception e) {
            throw new AuraHandledException('Export error: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getObjectDetail(String objectApiName) {
        if (!SecurityUtil.hasPowerToolsPermission()) {
            throw new AuraHandledException('Insufficient permissions');
        }
        Schema.SObjectType objectType = SecurityUtil.validateObjectName(objectApiName);
        Schema.DescribeSObjectResult describe = objectType.getDescribe();

        Map<String, Object> detail = new Map<String, Object>();
        detail.put('apiName', describe.getName());
        detail.put('label', describe.getLabel());

        List<Map<String, Object>> fields = new List<Map<String, Object>>();
        Map<String, Schema.SObjectField> fieldMap = describe.fields.getMap();
        for (String fieldName : fieldMap.keySet()) {
            Schema.DescribeFieldResult fieldDescribe = fieldMap.get(fieldName).getDescribe();
            if (fieldDescribe.isAccessible()) {
                Map<String, Object> field = new Map<String, Object>();
                field.put('apiName', fieldDescribe.getName());
                field.put('label', fieldDescribe.getLabel());
                field.put('type', fieldDescribe.getType().name());
                field.put('isCustom', fieldDescribe.isCustom());
                field.put('isRequired', !fieldDescribe.isNillable() && fieldDescribe.isCreateable());
                field.put('isNameField', fieldDescribe.isNameField());
                field.put('length', fieldDescribe.getLength());
                field.put('isUpdateable', fieldDescribe.isUpdateable());
                field.put('isFilterable', fieldDescribe.isFilterable());
                if (fieldDescribe.getType() == Schema.DisplayType.REFERENCE) {
                    field.put('relationshipName', fieldDescribe.getRelationshipName());
                    List<String> refTo = new List<String>();
                    for (Schema.SObjectType ref : fieldDescribe.getReferenceTo()) {
                        refTo.add(ref.getDescribe().getName());
                    }
                    field.put('referenceTo', refTo);
                }
                fields.add(field);
            }
        }
        detail.put('fields', fields);
        return detail;
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getFields(String objectApiName) {
        if (!SecurityUtil.hasPowerToolsPermission()) {
            throw new AuraHandledException('Insufficient permissions');
        }
        Schema.SObjectType objectType = SecurityUtil.validateObjectName(objectApiName);
        Schema.DescribeSObjectResult describe = objectType.getDescribe();
        List<Map<String, Object>> fields = new List<Map<String, Object>>();
        Map<String, Schema.SObjectField> fieldMap = describe.fields.getMap();
        for (String fieldName : fieldMap.keySet()) {
            Schema.DescribeFieldResult fd = fieldMap.get(fieldName).getDescribe();
            if (fd.isAccessible()) {
                Map<String, Object> f = new Map<String, Object>();
                f.put('apiName', fd.getName());
                f.put('label', fd.getLabel());
                f.put('type', fd.getType().name());
                f.put('isCustom', fd.isCustom());
                f.put('isRequired', !fd.isNillable() && fd.isCreateable());
                f.put('isNameField', fd.isNameField());
                f.put('isUpdateable', fd.isUpdateable());
                f.put('isCreateable', fd.isCreateable());
                if (fd.getType() == Schema.DisplayType.REFERENCE) {
                    f.put('relationshipName', fd.getRelationshipName());
                    List<String> refTo = new List<String>();
                    for (Schema.SObjectType ref : fd.getReferenceTo()) {
                        refTo.add(ref.getDescribe().getName());
                    }
                    f.put('referenceTo', refTo);
                }
                fields.add(f);
            }
        }
        return fields;
    }

    @AuraEnabled
    public static Map<String, Object> getQueryPlan(String queryString) {
        if (!SecurityUtil.hasPowerToolsPermission()) {
            throw new AuraHandledException('Insufficient permissions');
        }
        try {
            String path = '/services/data/v65.0/query/?explain=' + EncodingUtil.urlEncode(queryString, 'UTF-8');
            HttpRequest req = SelfOrgCalloutHelper.createRequest(path, 'GET');
            Http http = new Http();
            HttpResponse res = http.send(req);
            if (res.getStatusCode() == 200) {
                return (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            } else {
                throw new AuraHandledException('Query plan error: ' + res.getBody());
            }
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Query plan error: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static Map<String, Object> updateRecord(String recordId, String objectApiName, String fieldUpdatesJson) {
        if (!SecurityUtil.hasPowerToolsPermission()) {
            throw new AuraHandledException('Insufficient permissions');
        }
        try {
            Schema.SObjectType objectType = SecurityUtil.validateObjectName(objectApiName);
            SecurityUtil.checkObjectCRUD(objectType, SecurityUtil.CRUDOperation.UPDATEABLE);

            Map<String, Object> fieldUpdates = (Map<String, Object>) JSON.deserializeUntyped(fieldUpdatesJson);
            SObject record = objectType.newSObject(Id.valueOf(recordId));
            Map<String, Schema.SObjectField> fieldMap = objectType.getDescribe().fields.getMap();
            for (String fieldName : fieldUpdates.keySet()) {
                Schema.SObjectField field = fieldMap.get(fieldName.toLowerCase());
                if (field != null && field.getDescribe().isUpdateable()) {
                    record.put(fieldName, fieldUpdates.get(fieldName));
                }
            }
            update record;

            Map<String, Object> result = new Map<String, Object>();
            result.put('success', true);
            result.put('recordId', recordId);
            return result;
        } catch (SecurityUtil.SecurityException e) {
            throw new AuraHandledException(e.getMessage());
        } catch (DmlException e) {
            throw new AuraHandledException('Update failed: ' + e.getMessage());
        }
    }

    private static String extractObjectName(String queryString) {
        String normalized = queryString.trim().replaceAll('\\s+', ' ');
        Pattern p = Pattern.compile('(?i)\\bFROM\\s+([a-zA-Z][a-zA-Z0-9_]*)');
        Matcher m = p.matcher(normalized);
        if (m.find()) {
            return m.group(1);
        }
        throw new AuraHandledException('Could not determine object name from query');
    }

    private static List<ColumnInfo> buildColumns(Schema.SObjectType objectType, List<SObject> records) {
        List<ColumnInfo> columns = new List<ColumnInfo>();
        if (records.isEmpty()) {
            return columns;
        }
        Map<String, Schema.SObjectField> fieldMap = objectType.getDescribe().fields.getMap();
        Map<String, Object> firstRecord = records[0].getPopulatedFieldsAsMap();
        for (String fieldName : firstRecord.keySet()) {
            ColumnInfo col = new ColumnInfo();
            col.fieldName = fieldName;
            Schema.SObjectField field = fieldMap.get(fieldName.toLowerCase());
            if (field != null) {
                Schema.DescribeFieldResult fd = field.getDescribe();
                col.label = fd.getLabel();
                col.type = fd.getType().name();
            } else {
                col.label = fieldName;
                col.type = 'STRING';
            }
            columns.add(col);
        }
        return columns;
    }
}
