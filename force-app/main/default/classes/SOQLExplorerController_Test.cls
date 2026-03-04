@IsTest
private class SOQLExplorerController_Test {

    @TestSetup
    static void setupTestData() {
        List<Account> accs = new List<Account>();
        for (Integer i = 0; i < 5; i++) {
            accs.add(new Account(Name = 'SOQL Test ' + i));
        }
        insert accs;
    }

    // ─── executeQuery ───

    @IsTest
    static void testExecuteQuery() {
        SecurityUtil.testPermissionOverride = true;
        SOQLExplorerController.QueryResult result = SOQLExplorerController.executeQuery('SELECT Id, Name FROM Account LIMIT 5');
        System.assertNotEquals(null, result);
        System.assertEquals('Account', result.objectName);
        System.assert(result.records.size() > 0);
        System.assert(result.columns.size() > 0);
    }

    @IsTest
    static void testExecuteQuery_NoPermission() {
        SecurityUtil.testPermissionOverride = false;
        try {
            SOQLExplorerController.executeQuery('SELECT Id FROM Account');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
    }

    @IsTest
    static void testExecuteQuery_EmptyQuery() {
        SecurityUtil.testPermissionOverride = true;
        try {
            SOQLExplorerController.executeQuery('');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
    }

    @IsTest
    static void testExecuteQuery_InvalidQuery() {
        SecurityUtil.testPermissionOverride = true;
        try {
            SOQLExplorerController.executeQuery('SELECT FROM InvalidObj12345');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
    }

    // ─── executeQueryPaginated ───

    @IsTest
    static void testExecuteQueryPaginated() {
        SecurityUtil.testPermissionOverride = true;
        SOQLExplorerController.QueryResult result = SOQLExplorerController.executeQueryPaginated('SELECT Id, Name FROM Account', 2, 0);
        System.assertNotEquals(null, result);
        System.assert(result.records.size() <= 2);
        // With 5 accounts and page size 2, hasMore should be true
        System.assertEquals(true, result.hasMore);
    }

    @IsTest
    static void testExecuteQueryPaginated_WithExistingLimit() {
        SecurityUtil.testPermissionOverride = true;
        SOQLExplorerController.QueryResult result = SOQLExplorerController.executeQueryPaginated('SELECT Id FROM Account LIMIT 3', null, null);
        System.assertNotEquals(null, result);
        System.assert(result.records.size() <= 3);
    }

    @IsTest
    static void testExecuteQueryPaginated_DefaultParams() {
        SecurityUtil.testPermissionOverride = true;
        SOQLExplorerController.QueryResult result = SOQLExplorerController.executeQueryPaginated('SELECT Id FROM Account', null, null);
        System.assertNotEquals(null, result);
    }

    // ─── executeQueryCursor (needs HTTP mock) ───

    private class CursorMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setBody('{"totalSize":2,"done":true,"records":[{"attributes":{"type":"Account","url":"/services/data/v65.0/sobjects/Account/001xx"},"Id":"001000000000001AAA","Name":"Test 1"},{"attributes":{"type":"Account","url":"/services/data/v65.0/sobjects/Account/001xx"},"Id":"001000000000002AAA","Name":"Test 2"}]}');
            return res;
        }
    }

    private class CursorErrorMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(400);
            res.setBody('{"message":"Bad Request"}');
            return res;
        }
    }

    @IsTest
    static void testExecuteQueryCursor() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new CursorMock());

        Test.startTest();
        SOQLExplorerController.QueryResult result = SOQLExplorerController.executeQueryCursor('SELECT Id, Name FROM Account', null, 200);
        Test.stopTest();

        System.assertNotEquals(null, result);
        System.assertEquals(2, result.totalSize);
        System.assertEquals(false, result.hasMore);
    }

    @IsTest
    static void testExecuteQueryCursor_Error() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new CursorErrorMock());

        Test.startTest();
        try {
            SOQLExplorerController.executeQueryCursor('SELECT Id FROM Account', null, 200);
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
        Test.stopTest();
    }

    @IsTest
    static void testExecuteQueryCursor_EmptyQuery() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new CursorMock());

        Test.startTest();
        try {
            SOQLExplorerController.executeQueryCursor(null, null, 200);
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
        Test.stopTest();
    }

    @IsTest
    static void testExecuteQueryCursor_WithNextPath() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new CursorMock());

        Test.startTest();
        SOQLExplorerController.QueryResult result = SOQLExplorerController.executeQueryCursor(null, '/services/data/v65.0/query/01gxx-2000', 200);
        Test.stopTest();

        System.assertNotEquals(null, result);
    }

    @IsTest
    static void testExecuteQueryCursor_BatchSizeLimits() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new CursorMock());

        Test.startTest();
        // Test with oversized batch — should cap at 2000
        SOQLExplorerController.QueryResult result = SOQLExplorerController.executeQueryCursor('SELECT Id FROM Account', null, 5000);
        Test.stopTest();
        System.assertNotEquals(null, result);
    }

    // ─── executeSOSL ───

    @IsTest
    static void testExecuteSOSL() {
        SecurityUtil.testPermissionOverride = true;
        // SOSL in tests returns empty unless Test.setFixedSearchResults is used
        Test.setFixedSearchResults(new List<Id>());
        SOQLExplorerController.SOSLResult result = SOQLExplorerController.executeSOSL('FIND {Test} IN ALL FIELDS RETURNING Account(Id, Name)');
        System.assertNotEquals(null, result);
        System.assertNotEquals(null, result.objectGroups);
    }

    @IsTest
    static void testExecuteSOSL_NoPermission() {
        SecurityUtil.testPermissionOverride = false;
        try {
            SOQLExplorerController.executeSOSL('FIND {Test}');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
    }

    @IsTest
    static void testExecuteSOSL_Empty() {
        SecurityUtil.testPermissionOverride = true;
        try {
            SOQLExplorerController.executeSOSL('');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
    }

    // ─── createExportFile ───

    @IsTest
    static void testCreateExportFile() {
        SecurityUtil.testPermissionOverride = true;
        String docId = SOQLExplorerController.createExportFile('test_export.csv', 'Id,Name\n001,Test');
        System.assertNotEquals(null, docId);
    }

    @IsTest
    static void testCreateExportFile_NoPermission() {
        SecurityUtil.testPermissionOverride = false;
        try {
            SOQLExplorerController.createExportFile('test.csv', 'data');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
    }

    // ─── getObjectDetail ───

    @IsTest
    static void testGetObjectDetail() {
        SecurityUtil.testPermissionOverride = true;
        Map<String, Object> detail = SOQLExplorerController.getObjectDetail('Account');
        System.assertNotEquals(null, detail);
        System.assertEquals('Account', detail.get('apiName'));
        List<Map<String, Object>> fields = (List<Map<String, Object>>) detail.get('fields');
        System.assert(fields.size() > 0);
    }

    // ─── getFields ───

    @IsTest
    static void testGetFields() {
        SecurityUtil.testPermissionOverride = true;
        List<Map<String, Object>> fields = SOQLExplorerController.getFields('Account');
        System.assert(fields.size() > 0);
        // Check first field has expected keys
        Map<String, Object> first = fields[0];
        System.assert(first.containsKey('apiName'));
        System.assert(first.containsKey('type'));
    }

    // ─── getQueryPlan (needs HTTP mock) ───

    private class QueryPlanMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setBody('{"plans":[{"cardinality":100,"fields":[],"leadingOperationType":"TableScan","relativeCost":1.0,"sobjectCardinality":100,"sobjectType":"Account"}]}');
            return res;
        }
    }

    @IsTest
    static void testGetQueryPlan() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new QueryPlanMock());

        Test.startTest();
        Map<String, Object> plan = SOQLExplorerController.getQueryPlan('SELECT Id FROM Account');
        Test.stopTest();

        System.assertNotEquals(null, plan);
        System.assert(plan.containsKey('plans'));
    }

    // ─── executeQuery edge cases ───

    @IsTest
    static void testExecuteQuery_QueryException() {
        SecurityUtil.testPermissionOverride = true;
        try {
            // Valid object but invalid field → triggers QueryException catch (line 57-58)
            SOQLExplorerController.executeQuery('SELECT NonExistentField__xyz FROM Account');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: QueryException wrapped in AuraHandledException
        }
    }

    // ─── executeQueryPaginated edge cases ───

    @IsTest
    static void testExecuteQueryPaginated_NoPermission() {
        SecurityUtil.testPermissionOverride = false;
        try {
            SOQLExplorerController.executeQueryPaginated('SELECT Id FROM Account', 10, 0);
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException for no permission (line 72-73)
        }
    }

    @IsTest
    static void testExecuteQueryPaginated_EmptyQuery() {
        SecurityUtil.testPermissionOverride = true;
        try {
            SOQLExplorerController.executeQueryPaginated('', 10, 0);
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException for empty query (line 75-76)
        }
    }

    @IsTest
    static void testExecuteQueryPaginated_QueryException() {
        SecurityUtil.testPermissionOverride = true;
        try {
            // Valid object but invalid field → triggers QueryException catch (line 125-126)
            SOQLExplorerController.executeQueryPaginated('SELECT BadField__xyz FROM Account', 10, 0);
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: QueryException wrapped in AuraHandledException
        }
    }

    @IsTest
    static void testExecuteQueryPaginated_WithPageSizeAndOffset() {
        SecurityUtil.testPermissionOverride = true;
        SOQLExplorerController.QueryResult result = SOQLExplorerController.executeQueryPaginated('SELECT Id, Name FROM Account', 2, 2);
        System.assertNotEquals(null, result);
    }

    // ─── updateRecord ───

    @IsTest
    static void testUpdateRecord() {
        SecurityUtil.testPermissionOverride = true;
        Account acc = [SELECT Id FROM Account LIMIT 1];
        String updates = '{"Name": "Updated SOQL Name"}';
        Map<String, Object> result = SOQLExplorerController.updateRecord(String.valueOf(acc.Id), 'Account', updates);
        System.assertEquals(true, result.get('success'));
    }
}
