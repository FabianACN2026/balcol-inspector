@IsTest
private class DevToolsAccessController_Test {

    @IsTest
    static void testHasAccess() {
        Boolean result = DevToolsAccessController.hasAccess();
        // Just verify it returns a Boolean without throwing
        System.assertNotEquals(null, result);
    }
}
