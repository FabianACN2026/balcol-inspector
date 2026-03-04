public with sharing class SecurityUtil {

    @TestVisible
    private static Boolean testPermissionOverride = null;

    // Request-level cache for Schema.getGlobalDescribe() — computed once per transaction
    private static Map<String, Schema.SObjectType> globalDescribeCache;

    public enum CRUDOperation { READ, CREATEABLE, UPDATEABLE, DELETEABLE }

    public class SecurityException extends Exception {}

    public static Boolean hasPowerToolsPermission() {
        if (testPermissionOverride != null) {
            return testPermissionOverride;
        }
        return FeatureManagement.checkPermission('Dev_Tools_Power');
    }

    public static void checkObjectCRUD(Schema.SObjectType objectType, CRUDOperation operation) {
        Schema.DescribeSObjectResult describe = objectType.getDescribe();
        Boolean hasAccess = false;
        switch on operation {
            when READ {
                hasAccess = describe.isAccessible();
            }
            when CREATEABLE {
                hasAccess = describe.isCreateable();
            }
            when UPDATEABLE {
                hasAccess = describe.isUpdateable();
            }
            when DELETEABLE {
                hasAccess = describe.isDeletable();
            }
        }
        if (!hasAccess) {
            throw new SecurityException(
                'Insufficient ' + operation.name() + ' access on ' + describe.getName()
            );
        }
    }

    public static List<String> getAccessibleFields(Schema.SObjectType objectType, List<String> fieldNames, CRUDOperation operation) {
        List<String> accessible = new List<String>();
        Map<String, Schema.SObjectField> fieldMap = objectType.getDescribe().fields.getMap();
        for (String fieldName : fieldNames) {
            Schema.SObjectField field = fieldMap.get(fieldName.toLowerCase());
            if (field != null && isFieldAccessibleInternal(field.getDescribe(), operation)) {
                accessible.add(fieldName);
            }
        }
        return accessible;
    }

    public static List<String> getAllAccessibleFields(Schema.SObjectType objectType, CRUDOperation operation) {
        List<String> accessible = new List<String>();
        Map<String, Schema.SObjectField> fieldMap = objectType.getDescribe().fields.getMap();
        for (String fieldName : fieldMap.keySet()) {
            Schema.DescribeFieldResult fieldDescribe = fieldMap.get(fieldName).getDescribe();
            if (isFieldAccessibleInternal(fieldDescribe, operation)) {
                accessible.add(fieldDescribe.getName());
            }
        }
        return accessible;
    }

    public static String sanitizeForSOQL(String input) {
        if (String.isBlank(input)) {
            return '';
        }
        return String.escapeSingleQuotes(input.trim());
    }

    public static Schema.SObjectType validateObjectName(String objectName) {
        if (String.isBlank(objectName)) {
            throw new SecurityException('Object name cannot be blank');
        }
        if (globalDescribeCache == null) {
            globalDescribeCache = Schema.getGlobalDescribe();
        }
        Schema.SObjectType objectType = globalDescribeCache.get(objectName);
        if (objectType == null) {
            throw new SecurityException('Invalid object: ' + objectName);
        }
        return objectType;
    }

    public static Boolean validateApiName(String apiName) {
        if (String.isBlank(apiName)) {
            return false;
        }
        Pattern p = Pattern.compile('^[a-zA-Z][a-zA-Z0-9_]*$');
        Matcher m = p.matcher(apiName);
        return m.matches();
    }

    public static Boolean isFieldAccessible(Schema.SObjectType objectType, String fieldName, CRUDOperation operation) {
        Map<String, Schema.SObjectField> fieldMap = objectType.getDescribe().fields.getMap();
        Schema.SObjectField field = fieldMap.get(fieldName.toLowerCase());
        if (field == null) {
            return false;
        }
        return isFieldAccessibleInternal(field.getDescribe(), operation);
    }

    private static Boolean isFieldAccessibleInternal(Schema.DescribeFieldResult fieldDescribe, CRUDOperation operation) {
        switch on operation {
            when READ {
                return fieldDescribe.isAccessible();
            }
            when CREATEABLE {
                return fieldDescribe.isCreateable();
            }
            when UPDATEABLE {
                return fieldDescribe.isUpdateable();
            }
            when else {
                return fieldDescribe.isAccessible();
            }
        }
    }
}
