/**
 * @description Controller for Metadata Browser / Schema operations.
 *              Provides object listing via EntityDefinition (fast) and
 *              detailed field/relationship metadata for autocomplete.
 * @group Developer Tools
 */
public with sharing class MetadataBrowserController {

    /**
     * Get list of accessible objects with optional search filtering.
     * Uses EntityDefinition SOQL for efficiency (vs iterating Schema.getGlobalDescribe()).
     * Note: EntityDefinition doesn't support OR/disjunctions in SOQL, so we
     * filter by both API name and Label in Apex after query.
     * @param searchTerm Optional search term to filter objects by API name or label
     * @return List of ObjectSummary wrappers
     */
    @AuraEnabled(cacheable=true)
    public static List<ObjectSummary> getAccessibleObjects(String searchTerm) {
        Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
        String searchTermLower = String.isNotBlank(searchTerm)
            ? searchTerm.trim().toLowerCase()
            : null;

        List<ObjectSummary> results = new List<ObjectSummary>();
        for (String objName : globalDescribe.keySet()) {
            Schema.DescribeSObjectResult objDesc = globalDescribe.get(objName).getDescribe();
            if (!objDesc.isAccessible() || !objDesc.isQueryable()) {
                continue;
            }
            String apiName = objDesc.getName();
            String label = objDesc.getLabel();
            if (
                searchTermLower == null ||
                apiName.toLowerCase().contains(searchTermLower) ||
                (label != null && label.toLowerCase().contains(searchTermLower))
            ) {
                results.add(new ObjectSummary(apiName, label, objDesc.getKeyPrefix()));
            }
        }
        results.sort();
        return results;
    }

    /**
     * Get detailed metadata for a specific object.
     * Includes fields with relationship info, child relationships, and record types.
     * @param objectApiName The API name of the object
     * @return ObjectDetail wrapper with complete metadata
     */
    @AuraEnabled(cacheable=true)
    public static ObjectDetail getObjectDetail(String objectApiName) {
        Schema.SObjectType objType = SecurityUtil.validateObjectName(objectApiName);
        SecurityUtil.checkObjectCRUD(objType, SecurityUtil.CRUDOperation.READ);
        Schema.DescribeSObjectResult dsr = objType.getDescribe();
        return new ObjectDetail(dsr);
    }

    // ─── Wrapper Classes ───

    public class ObjectSummary implements Comparable {
        @AuraEnabled public String apiName;
        @AuraEnabled public String label;
        @AuraEnabled public String keyPrefix;
        @AuraEnabled public Boolean isCustom;

        public ObjectSummary(EntityDefinition ed) {
            this.apiName = ed.QualifiedApiName;
            this.label = ed.Label;
            this.keyPrefix = ed.KeyPrefix;
            this.isCustom = ed.QualifiedApiName.endsWith('__c');
        }

        public ObjectSummary(String apiName, String label, String keyPrefix) {
            this.apiName = apiName;
            this.label = label;
            this.keyPrefix = keyPrefix;
            this.isCustom = apiName.endsWith('__c');
        }

        public Integer compareTo(Object other) {
            ObjectSummary o = (ObjectSummary) other;
            return this.label != null && o.label != null
                ? this.label.compareTo(o.label)
                : this.apiName.compareTo(o.apiName);
        }
    }

    public class ObjectDetail {
        @AuraEnabled public String apiName;
        @AuraEnabled public String label;
        @AuraEnabled public String keyPrefix;
        @AuraEnabled public Integer fieldCount;
        @AuraEnabled public List<FieldInfo> fields;
        @AuraEnabled public List<RelationshipInfo> relationships;
        @AuraEnabled public List<RecordTypeInfo> recordTypes;

        public ObjectDetail(Schema.DescribeSObjectResult dsr) {
            this.apiName = dsr.getName();
            this.label = dsr.getLabel();
            this.keyPrefix = dsr.getKeyPrefix();

            // Fields — only include accessible fields
            this.fields = new List<FieldInfo>();
            Map<String, Schema.SObjectField> fieldMap = dsr.fields.getMap();
            for (String fieldName : fieldMap.keySet()) {
                Schema.DescribeFieldResult dfr = fieldMap.get(fieldName).getDescribe();
                if (dfr.isAccessible()) {
                    this.fields.add(new FieldInfo(dfr));
                }
            }
            this.fieldCount = this.fields.size();

            // Child relationships (capped at 50 for performance)
            this.relationships = new List<RelationshipInfo>();
            for (Schema.ChildRelationship cr : dsr.getChildRelationships()) {
                if (cr.getRelationshipName() != null && this.relationships.size() < 50) {
                    this.relationships.add(new RelationshipInfo(cr));
                }
            }

            // Record types — only available, non-master
            this.recordTypes = new List<RecordTypeInfo>();
            for (Schema.RecordTypeInfo rti : dsr.getRecordTypeInfos()) {
                if (rti.isAvailable() && !rti.isMaster()) {
                    this.recordTypes.add(new RecordTypeInfo(rti));
                }
            }
        }
    }

    public class FieldInfo {
        @AuraEnabled public String apiName;
        @AuraEnabled public String label;
        @AuraEnabled public String type;
        @AuraEnabled public Integer length;
        @AuraEnabled public Boolean isCustom;
        @AuraEnabled public Boolean isRequired;
        @AuraEnabled public Boolean isUpdateable;
        @AuraEnabled public Boolean isNameField;
        @AuraEnabled public Boolean isFilterable;
        @AuraEnabled public Boolean isUnique;
        @AuraEnabled public Boolean isExternalId;
        @AuraEnabled public List<String> referenceTo;
        @AuraEnabled public String relationshipName;
        @AuraEnabled public List<String> picklistValues;

        public FieldInfo(Schema.DescribeFieldResult dfr) {
            this.apiName = dfr.getName();
            this.label = dfr.getLabel();
            this.type = dfr.getType().name();
            this.length = dfr.getLength();
            this.isCustom = dfr.isCustom();
            this.isRequired = !dfr.isNillable() && dfr.isCreateable();
            this.isUpdateable = dfr.isUpdateable();
            this.isNameField = dfr.isNameField();
            this.isFilterable = dfr.isFilterable();
            this.isUnique = dfr.isUnique();
            this.isExternalId = dfr.isExternalId();
            this.relationshipName = dfr.getRelationshipName();

            if (dfr.getType() == Schema.DisplayType.REFERENCE) {
                this.referenceTo = new List<String>();
                for (Schema.SObjectType ref : dfr.getReferenceTo()) {
                    this.referenceTo.add(ref.getDescribe().getName());
                }
            }

            if (
                dfr.getType() == Schema.DisplayType.PICKLIST ||
                dfr.getType() == Schema.DisplayType.MULTIPICKLIST
            ) {
                this.picklistValues = new List<String>();
                for (Schema.PicklistEntry pe : dfr.getPicklistValues()) {
                    if (pe.isActive()) {
                        this.picklistValues.add(pe.getValue());
                    }
                }
            }
        }
    }

    public class RelationshipInfo {
        @AuraEnabled public String relationshipName;
        @AuraEnabled public String childObject;
        @AuraEnabled public String fieldName;

        public RelationshipInfo(Schema.ChildRelationship cr) {
            this.relationshipName = cr.getRelationshipName();
            this.childObject = cr.getChildSObject().getDescribe().getName();
            this.fieldName = cr.getField().getDescribe().getName();
        }
    }

    public class RecordTypeInfo {
        @AuraEnabled public String name;
        @AuraEnabled public String developerName;
        @AuraEnabled public Id recordTypeId;
        @AuraEnabled public Boolean isDefault;

        public RecordTypeInfo(Schema.RecordTypeInfo rti) {
            this.name = rti.getName();
            this.developerName = rti.getDeveloperName();
            this.recordTypeId = rti.getRecordTypeId();
            this.isDefault = rti.isDefaultRecordTypeMapping();
        }
    }
}
