public with sharing class RecordInspectorController {

    public class RecordData {
        @AuraEnabled public String recordId;
        @AuraEnabled public String objectApiName;
        @AuraEnabled public String objectLabel;
        @AuraEnabled public Integer fieldCount;
        @AuraEnabled public List<FieldMetadata> fields;
        @AuraEnabled public Map<String, Object> fieldValues;
        @AuraEnabled public Datetime createdDate;
        @AuraEnabled public Datetime lastModifiedDate;
        @AuraEnabled public String createdByName;
        @AuraEnabled public String lastModifiedByName;
    }

    public class FieldMetadata {
        @AuraEnabled public String apiName;
        @AuraEnabled public String label;
        @AuraEnabled public String type;
        @AuraEnabled public Integer length;
        @AuraEnabled public Boolean isCustom;
        @AuraEnabled public Boolean isRequired;
        @AuraEnabled public Boolean isUpdateable;
        @AuraEnabled public Boolean isCalculated;
        @AuraEnabled public Boolean isNameField;
        @AuraEnabled public String description;
        @AuraEnabled public String inlineHelpText;
        @AuraEnabled public List<Map<String, String>> picklistValues;
    }

    public class ChildRelationshipInfo {
        @AuraEnabled public String relationshipName;
        @AuraEnabled public String childObjectApiName;
        @AuraEnabled public String childObjectLabel;
        @AuraEnabled public String fieldName;
        @AuraEnabled public Integer recordCount;
    }

    public class FieldHistoryItem {
        @AuraEnabled public String fieldApiName;
        @AuraEnabled public String fieldLabel;
        @AuraEnabled public Object oldValue;
        @AuraEnabled public Object newValue;
        @AuraEnabled public Datetime createdDate;
        @AuraEnabled public String createdByName;
    }

    public class BulkDeleteResult {
        @AuraEnabled public Integer totalRequested;
        @AuraEnabled public Integer successCount;
        @AuraEnabled public Integer failureCount;
        @AuraEnabled public List<String> errors;
        @AuraEnabled public List<String> successIds;
    }

    @AuraEnabled
    public static RecordData getRecordData(Id recordId) {
        try {
            Schema.SObjectType objectType = recordId.getSObjectType();
            Schema.DescribeSObjectResult describe = objectType.getDescribe();
            SecurityUtil.checkObjectCRUD(objectType, SecurityUtil.CRUDOperation.READ);

            List<String> accessibleFields = SecurityUtil.getAllAccessibleFields(objectType, SecurityUtil.CRUDOperation.READ);
            if (accessibleFields.isEmpty()) {
                throw new AuraHandledException('No accessible fields on ' + describe.getName());
            }

            // Include audit relationship fields in query for faster loading
            Set<String> queryFields = new Set<String>(accessibleFields);
            queryFields.add('CreatedBy.Name');
            queryFields.add('LastModifiedBy.Name');
            String query = 'SELECT ' + String.join(new List<String>(queryFields), ', ') + ' FROM ' + describe.getName() + ' WHERE Id = :recordId LIMIT 1';
            List<SObject> records = Database.query(query);
            if (records.isEmpty()) {
                throw new AuraHandledException('Record not found: ' + recordId);
            }
            SObject record = records[0];

            RecordData data = new RecordData();
            data.recordId = String.valueOf(recordId);
            data.objectApiName = describe.getName();
            data.objectLabel = describe.getLabel();
            data.fieldValues = record.getPopulatedFieldsAsMap();

            // Build field metadata in single pass using cached fieldMap
            List<FieldMetadata> fieldMetas = new List<FieldMetadata>();
            Map<String, Schema.SObjectField> fieldMap = describe.fields.getMap();
            for (String fieldName : accessibleFields) {
                Schema.SObjectField sField = fieldMap.get(fieldName.toLowerCase());
                if (sField == null) continue;
                Schema.DescribeFieldResult fd = sField.getDescribe();
                FieldMetadata meta = new FieldMetadata();
                meta.apiName = fd.getName();
                meta.label = fd.getLabel();
                Schema.DisplayType dtype = fd.getType();
                meta.type = dtype.name();
                meta.length = fd.getLength();
                meta.isCustom = fd.isCustom();
                meta.isRequired = !fd.isNillable() && fd.isCreateable();
                meta.isUpdateable = fd.isUpdateable();
                meta.isCalculated = fd.isCalculated();
                meta.isNameField = fd.isNameField();
                meta.description = fd.getInlineHelpText();
                meta.inlineHelpText = fd.getInlineHelpText();
                if (dtype == Schema.DisplayType.PICKLIST || dtype == Schema.DisplayType.MULTIPICKLIST) {
                    List<Map<String, String>> plValues = new List<Map<String, String>>();
                    for (Schema.PicklistEntry pe : fd.getPicklistValues()) {
                        if (pe.isActive()) {
                            plValues.add(new Map<String, String>{ 'label' => pe.getLabel(), 'value' => pe.getValue() });
                        }
                    }
                    meta.picklistValues = plValues;
                }
                fieldMetas.add(meta);
            }
            data.fields = fieldMetas;
            data.fieldCount = fieldMetas.size();
            data.createdDate = (Datetime) record.get('CreatedDate');
            data.lastModifiedDate = (Datetime) record.get('LastModifiedDate');

            try {
                data.createdByName = (String) record.getSObject('CreatedBy')?.get('Name');
                data.lastModifiedByName = (String) record.getSObject('LastModifiedBy')?.get('Name');
            } catch (Exception e) {
                // Related name fields may not be included
            }

            return data;
        } catch (AuraHandledException e) {
            throw e;
        } catch (SecurityUtil.SecurityException e) {
            throw new AuraHandledException(e.getMessage());
        } catch (Exception e) {
            throw new AuraHandledException('Error inspecting record: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteRecord(Id recordId) {
        try {
            Schema.SObjectType objectType = recordId.getSObjectType();
            SecurityUtil.checkObjectCRUD(objectType, SecurityUtil.CRUDOperation.DELETEABLE);
            SObject record = objectType.newSObject(recordId);
            delete record;
        } catch (SecurityUtil.SecurityException e) {
            throw new AuraHandledException(e.getMessage());
        } catch (DmlException e) {
            throw new AuraHandledException('Delete failed: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static BulkDeleteResult bulkDeleteRecords(List<Id> recordIds) {
        BulkDeleteResult result = new BulkDeleteResult();
        result.totalRequested = recordIds.size();
        result.successCount = 0;
        result.failureCount = 0;
        result.errors = new List<String>();
        result.successIds = new List<String>();

        if (recordIds.isEmpty()) {
            return result;
        }

        try {
            Schema.SObjectType objectType = recordIds[0].getSObjectType();
            SecurityUtil.checkObjectCRUD(objectType, SecurityUtil.CRUDOperation.DELETEABLE);

            List<SObject> recordsToDelete = new List<SObject>();
            for (Id recId : recordIds) {
                recordsToDelete.add(objectType.newSObject(recId));
            }

            Database.DeleteResult[] deleteResults = Database.delete(recordsToDelete, false);
            for (Integer i = 0; i < deleteResults.size(); i++) {
                if (deleteResults[i].isSuccess()) {
                    result.successCount++;
                    result.successIds.add(String.valueOf(recordIds[i]));
                } else {
                    result.failureCount++;
                    for (Database.Error err : deleteResults[i].getErrors()) {
                        result.errors.add('Row ' + i + ': ' + err.getMessage());
                    }
                }
            }
        } catch (SecurityUtil.SecurityException e) {
            throw new AuraHandledException(e.getMessage());
        }
        return result;
    }

    @AuraEnabled
    public static BulkDeleteResult cascadeDeleteRecord(Id recordId) {
        BulkDeleteResult result = new BulkDeleteResult();
        result.totalRequested = 1;
        result.successCount = 0;
        result.failureCount = 0;
        result.errors = new List<String>();
        result.successIds = new List<String>();

        try {
            Schema.SObjectType objectType = recordId.getSObjectType();
            SecurityUtil.checkObjectCRUD(objectType, SecurityUtil.CRUDOperation.DELETEABLE);
            Schema.DescribeSObjectResult describe = objectType.getDescribe();

            // Collect eligible child relationships via describe only (no SOQL cost)
            List<Map<String, String>> childInfos = new List<Map<String, String>>();
            for (Schema.ChildRelationship cr : describe.getChildRelationships()) {
                if (cr.getRelationshipName() == null || cr.isCascadeDelete()) continue;
                Schema.DescribeSObjectResult childDescribe = cr.getChildSObject().getDescribe();
                if (!childDescribe.isAccessible() || !childDescribe.isQueryable() || !childDescribe.isDeletable()) continue;
                Map<String, String> info = new Map<String, String>();
                info.put('obj', childDescribe.getName());
                info.put('field', cr.getField().getDescribe().getName());
                childInfos.add(info);
            }

            // Query and delete children, respecting governor limits
            for (Map<String, String> info : childInfos) {
                if (Limits.getQueries() >= Limits.getLimitQueries() - 5) {
                    result.errors.add('Stopped early: approaching SOQL query limit (' + Limits.getQueries() + ' used). Some child objects were not processed.');
                    break;
                }
                String childObject = info.get('obj');
                String fieldName = info.get('field');
                try {
                    String q = 'SELECT Id FROM ' + String.escapeSingleQuotes(childObject) +
                               ' WHERE ' + String.escapeSingleQuotes(fieldName) + ' = :recordId LIMIT 10000';
                    List<SObject> children = Database.query(q);
                    if (!children.isEmpty()) {
                        Database.DeleteResult[] childResults = Database.delete(children, false);
                        for (Database.DeleteResult dr : childResults) {
                            if (dr.isSuccess()) {
                                result.successCount++;
                            } else {
                                for (Database.Error err : dr.getErrors()) {
                                    result.errors.add(childObject + ': ' + err.getMessage());
                                }
                                result.failureCount++;
                            }
                        }
                    }
                } catch (Exception e) {
                    // Skip non-queryable/non-deletable children silently
                }
            }

            // Now delete the parent record
            SObject record = objectType.newSObject(recordId);
            delete record;
            result.successCount++;
            result.successIds.add(String.valueOf(recordId));
        } catch (SecurityUtil.SecurityException e) {
            throw new AuraHandledException(e.getMessage());
        } catch (DmlException e) {
            result.failureCount++;
            result.errors.add('Parent: ' + e.getMessage());
        }
        return result;
    }

    @AuraEnabled
    public static Boolean hasChildRelationships(Id recordId) {
        Schema.SObjectType objectType = recordId.getSObjectType();
        List<Schema.ChildRelationship> children = objectType.getDescribe().getChildRelationships();
        return !children.isEmpty();
    }

    @AuraEnabled
    public static List<ChildRelationshipInfo> getChildRelationships(Id recordId) {
        Schema.SObjectType objectType = recordId.getSObjectType();
        Schema.DescribeSObjectResult describe = objectType.getDescribe();
        List<ChildRelationshipInfo> results = new List<ChildRelationshipInfo>();

        Integer maxRelationships = 20;
        for (Schema.ChildRelationship cr : describe.getChildRelationships()) {
            if (cr.getRelationshipName() != null && results.size() < maxRelationships) {
                Schema.DescribeSObjectResult childDescribe = cr.getChildSObject().getDescribe();
                if (childDescribe.isAccessible() && childDescribe.isQueryable()) {
                    ChildRelationshipInfo info = new ChildRelationshipInfo();
                    info.relationshipName = cr.getRelationshipName();
                    info.childObjectApiName = childDescribe.getName();
                    info.childObjectLabel = childDescribe.getLabel();
                    info.fieldName = cr.getField().getDescribe().getName();
                    try {
                        // Use LIMIT 1 to check existence rather than exact count — much cheaper
                        String checkQuery = 'SELECT Id FROM ' + childDescribe.getName() + ' WHERE ' + info.fieldName + ' = :recordId LIMIT 1';
                        List<SObject> checkResult = Database.query(checkQuery);
                        info.recordCount = checkResult.isEmpty() ? 0 : 1;
                    } catch (Exception e) {
                        info.recordCount = 0;
                    }
                    results.add(info);
                }
            }
        }
        return results;
    }

    @AuraEnabled
    public static List<FieldHistoryItem> getRecordHistory(Id recordId) {
        Schema.SObjectType objectType = recordId.getSObjectType();
        Schema.DescribeSObjectResult describe = objectType.getDescribe();
        String objectName = describe.getName();
        String historyObject = objectName.endsWith('__c')
            ? objectName.replace('__c', '__History')
            : objectName + 'History';

        List<FieldHistoryItem> items = new List<FieldHistoryItem>();
        try {
            Schema.SObjectType histType;
            try {
                histType = SecurityUtil.validateObjectName(historyObject);
            } catch (Exception ex) {
                return items;
            }
            if (histType == null || !histType.getDescribe().isAccessible()) {
                return items;
            }
            String query = 'SELECT Field, OldValue, NewValue, CreatedDate, CreatedBy.Name FROM ' + historyObject + ' WHERE ParentId = :recordId ORDER BY CreatedDate DESC LIMIT 100';
            List<SObject> histRecords = Database.query(query);

            Map<String, Schema.SObjectField> fieldMap = describe.fields.getMap();
            for (SObject hr : histRecords) {
                FieldHistoryItem item = new FieldHistoryItem();
                item.fieldApiName = String.valueOf(hr.get('Field'));
                Schema.SObjectField sField = fieldMap.get(item.fieldApiName?.toLowerCase());
                item.fieldLabel = sField != null ? sField.getDescribe().getLabel() : item.fieldApiName;
                item.oldValue = hr.get('OldValue');
                item.newValue = hr.get('NewValue');
                item.createdDate = (Datetime) hr.get('CreatedDate');
                try {
                    item.createdByName = (String) hr.getSObject('CreatedBy')?.get('Name');
                } catch (Exception e) {
                    item.createdByName = 'Unknown';
                }
                items.add(item);
            }
        } catch (Exception e) {
            // History tracking not enabled or not accessible
        }
        return items;
    }

    @AuraEnabled
    public static Map<String, Object> updateRecordFields(Id recordId, String fieldUpdatesJson) {
        try {
            Schema.SObjectType objectType = recordId.getSObjectType();
            SecurityUtil.checkObjectCRUD(objectType, SecurityUtil.CRUDOperation.UPDATEABLE);
            Map<String, Object> fieldUpdates = (Map<String, Object>) JSON.deserializeUntyped(fieldUpdatesJson);
            SObject record = objectType.newSObject(recordId);
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
            result.put('recordId', String.valueOf(recordId));
            return result;
        } catch (SecurityUtil.SecurityException e) {
            throw new AuraHandledException(e.getMessage());
        } catch (DmlException e) {
            throw new AuraHandledException('Update failed: ' + e.getMessage());
        }
    }
}
