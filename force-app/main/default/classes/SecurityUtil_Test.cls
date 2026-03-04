@IsTest
private class SecurityUtil_Test {

    @IsTest
    static void testHasPowerToolsPermission_Default() {
        // No override — calls FeatureManagement (returns false without perm set)
        Boolean result = SecurityUtil.hasPowerToolsPermission();
        System.assertNotEquals(null, result);
    }

    @IsTest
    static void testHasPowerToolsPermission_OverrideTrue() {
        SecurityUtil.testPermissionOverride = true;
        System.assertEquals(true, SecurityUtil.hasPowerToolsPermission());
    }

    @IsTest
    static void testHasPowerToolsPermission_OverrideFalse() {
        SecurityUtil.testPermissionOverride = false;
        System.assertEquals(false, SecurityUtil.hasPowerToolsPermission());
    }

    @IsTest
    static void testCheckObjectCRUD_Read() {
        // Account should be readable
        SecurityUtil.checkObjectCRUD(Account.SObjectType, SecurityUtil.CRUDOperation.READ);
    }

    @IsTest
    static void testCheckObjectCRUD_Createable() {
        SecurityUtil.checkObjectCRUD(Account.SObjectType, SecurityUtil.CRUDOperation.CREATEABLE);
    }

    @IsTest
    static void testCheckObjectCRUD_Updateable() {
        SecurityUtil.checkObjectCRUD(Account.SObjectType, SecurityUtil.CRUDOperation.UPDATEABLE);
    }

    @IsTest
    static void testCheckObjectCRUD_Deleteable() {
        SecurityUtil.checkObjectCRUD(Account.SObjectType, SecurityUtil.CRUDOperation.DELETEABLE);
    }

    @IsTest
    static void testGetAccessibleFields() {
        List<String> fields = SecurityUtil.getAccessibleFields(
            Account.SObjectType,
            new List<String>{'Name', 'Id', 'NonExistentField__xyz'},
            SecurityUtil.CRUDOperation.READ
        );
        System.assert(fields.contains('Name'));
        System.assert(fields.contains('Id'));
        System.assert(!fields.contains('NonExistentField__xyz'));
    }

    @IsTest
    static void testGetAllAccessibleFields() {
        List<String> fields = SecurityUtil.getAllAccessibleFields(Account.SObjectType, SecurityUtil.CRUDOperation.READ);
        System.assert(!fields.isEmpty());
        // Should contain standard fields like Name, Id
    }

    @IsTest
    static void testSanitizeForSOQL() {
        System.assertEquals('', SecurityUtil.sanitizeForSOQL(null));
        System.assertEquals('', SecurityUtil.sanitizeForSOQL(''));
        System.assertEquals('', SecurityUtil.sanitizeForSOQL('   '));
        System.assertEquals('test', SecurityUtil.sanitizeForSOQL('test'));
        String result = SecurityUtil.sanitizeForSOQL('test\'injection');
        System.assert(result.contains('\\'));
    }

    @IsTest
    static void testValidateObjectName_Valid() {
        Schema.SObjectType result = SecurityUtil.validateObjectName('Account');
        System.assertNotEquals(null, result);
    }

    @IsTest
    static void testValidateObjectName_Blank() {
        try {
            SecurityUtil.validateObjectName('');
            System.assert(false, 'Expected exception');
        } catch (SecurityUtil.SecurityException e) {
            System.assert(e.getMessage().contains('blank'));
        }
    }

    @IsTest
    static void testValidateObjectName_Invalid() {
        try {
            SecurityUtil.validateObjectName('NonExistentObject__xyz');
            System.assert(false, 'Expected exception');
        } catch (SecurityUtil.SecurityException e) {
            System.assert(e.getMessage().contains('Invalid object'));
        }
    }

    @IsTest
    static void testValidateApiName() {
        System.assertEquals(true, SecurityUtil.validateApiName('Account'));
        System.assertEquals(true, SecurityUtil.validateApiName('My_Custom__c'));
        System.assertEquals(false, SecurityUtil.validateApiName(null));
        System.assertEquals(false, SecurityUtil.validateApiName(''));
        System.assertEquals(false, SecurityUtil.validateApiName('123Invalid'));
    }

    @IsTest
    static void testIsFieldAccessible() {
        System.assertEquals(true, SecurityUtil.isFieldAccessible(Account.SObjectType, 'Name', SecurityUtil.CRUDOperation.READ));
        System.assertEquals(false, SecurityUtil.isFieldAccessible(Account.SObjectType, 'NonExistentField__xyz', SecurityUtil.CRUDOperation.READ));
    }
}
