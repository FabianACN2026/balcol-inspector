public with sharing class DevToolsAccessController {

    private static final String ACCESS_PERMISSION = 'Dev_Tools_Access';

    @AuraEnabled(cacheable=true)
    public static Boolean hasAccess() {
        return FeatureManagement.checkPermission(ACCESS_PERMISSION);
    }
}
