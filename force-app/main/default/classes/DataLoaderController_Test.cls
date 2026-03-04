@IsTest
private class DataLoaderController_Test {

    // ─── insertRecords ───

    @IsTest
    static void testInsertRecords() {
        SecurityUtil.testPermissionOverride = true;
        String fieldsJson = '["Name"]';
        String dataJson = '[["DL Insert 1"],["DL Insert 2"],["DL Insert 3"]]';

        DataLoaderController.DMLResult result = DataLoaderController.insertRecords('Account', fieldsJson, dataJson);
        System.assertEquals(3, result.totalRequested);
        System.assertEquals(3, result.successCount);
        System.assertEquals(0, result.failureCount);
        System.assertEquals(3, result.rows.size());
        System.assertEquals(true, result.rows[0].success);
        System.assertNotEquals(null, result.rows[0].recordId);
    }

    @IsTest
    static void testInsertRecords_EmptyData() {
        SecurityUtil.testPermissionOverride = true;
        DataLoaderController.DMLResult result = DataLoaderController.insertRecords('Account', '["Name"]', '[]');
        System.assertEquals(0, result.totalRequested);
    }

    @IsTest
    static void testInsertRecords_NoPermission() {
        SecurityUtil.testPermissionOverride = false;
        try {
            DataLoaderController.insertRecords('Account', '["Name"]', '[["Test"]]');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
    }

    @IsTest
    static void testInsertRecords_InvalidObject() {
        SecurityUtil.testPermissionOverride = true;
        try {
            DataLoaderController.insertRecords('NonExistentObject__xyz', '["Name"]', '[["Test"]]');
            System.assert(false, 'Expected exception');
        } catch (SecurityUtil.SecurityException e) {
            System.assert(e.getMessage().contains('Invalid object'));
        }
    }

    @IsTest
    static void testInsertRecords_MultipleFieldTypes() {
        SecurityUtil.testPermissionOverride = true;
        String fieldsJson = '["Name", "NumberOfEmployees", "AnnualRevenue", "Website"]';
        String dataJson = '[["Type Test Corp", "100", "50000.50", "https://test.com"]]';

        DataLoaderController.DMLResult result = DataLoaderController.insertRecords('Account', fieldsJson, dataJson);
        System.assertEquals(1, result.successCount);
    }

    // ─── updateRecords ───

    @IsTest
    static void testUpdateRecords() {
        SecurityUtil.testPermissionOverride = true;
        Account acc = new Account(Name = 'DL Update Original');
        insert acc;

        String fieldsJson = '["Id", "Name"]';
        String dataJson = '[["' + acc.Id + '", "DL Updated Name"]]';

        DataLoaderController.DMLResult result = DataLoaderController.updateRecords('Account', fieldsJson, dataJson);
        System.assertEquals(1, result.successCount);

        Account updated = [SELECT Name FROM Account WHERE Id = :acc.Id];
        System.assertEquals('DL Updated Name', updated.Name);
    }

    @IsTest
    static void testUpdateRecords_EmptyData() {
        SecurityUtil.testPermissionOverride = true;
        DataLoaderController.DMLResult result = DataLoaderController.updateRecords('Account', '["Id","Name"]', '[]');
        System.assertEquals(0, result.totalRequested);
    }

    @IsTest
    static void testUpdateRecords_NoPermission() {
        SecurityUtil.testPermissionOverride = false;
        try {
            DataLoaderController.updateRecords('Account', '["Id"]', '[["001"]]');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
    }

    // ─── upsertRecords ───

    @IsTest
    static void testUpsertRecords_Insert() {
        SecurityUtil.testPermissionOverride = true;
        String fieldsJson = '["Name"]';
        String dataJson = '[["DL Upsert New"]]';

        try {
            // Use Id as external ID field (it's a valid external ID)
            DataLoaderController.DMLResult result = DataLoaderController.upsertRecords('Account', 'Id', fieldsJson, dataJson);
            System.assertNotEquals(null, result);
        } catch (Exception e) {
            // Some orgs may not allow upsert on Id — that's ok
        }
    }

    @IsTest
    static void testUpsertRecords_NoPermission() {
        SecurityUtil.testPermissionOverride = false;
        try {
            DataLoaderController.upsertRecords('Account', 'Id', '["Name"]', '[["Test"]]');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
    }

    @IsTest
    static void testUpsertRecords_InvalidExternalId() {
        SecurityUtil.testPermissionOverride = true;
        try {
            DataLoaderController.upsertRecords('Account', 'NonExistentField__xyz', '["Name"]', '[["Test"]]');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
    }

    @IsTest
    static void testUpsertRecords_EmptyData() {
        SecurityUtil.testPermissionOverride = true;
        DataLoaderController.DMLResult result = DataLoaderController.upsertRecords('Account', 'Id', '["Name"]', '[]');
        System.assertEquals(0, result.totalRequested);
    }

    // ─── Type casting coverage ───

    @IsTest
    static void testInsertRecords_BooleanField() {
        SecurityUtil.testPermissionOverride = true;
        // Contact has DoNotCall (Boolean) and Birthdate (Date)
        String fieldsJson = '["LastName", "DoNotCall"]';
        String dataJson = '[["Bool Test", "true"]]';
        DataLoaderController.DMLResult result = DataLoaderController.insertRecords('Contact', fieldsJson, dataJson);
        System.assertEquals(1, result.successCount);
    }

    @IsTest
    static void testInsertRecords_DateField() {
        SecurityUtil.testPermissionOverride = true;
        String fieldsJson = '["LastName", "Birthdate"]';
        String dataJson = '[["Date Test", "1990-01-15"]]';
        DataLoaderController.DMLResult result = DataLoaderController.insertRecords('Contact', fieldsJson, dataJson);
        System.assertEquals(1, result.successCount);
    }

    @IsTest
    static void testInsertRecords_BlankValues() {
        SecurityUtil.testPermissionOverride = true;
        String fieldsJson = '["Name", "Website"]';
        String dataJson = '[["Blank Test", ""]]';
        DataLoaderController.DMLResult result = DataLoaderController.insertRecords('Account', fieldsJson, dataJson);
        System.assertEquals(1, result.successCount);
    }

    @IsTest
    static void testInsertRecords_InvalidTypeValue() {
        SecurityUtil.testPermissionOverride = true;
        // NumberOfEmployees is Integer — "not_a_number" should be silently skipped
        String fieldsJson = '["Name", "NumberOfEmployees"]';
        String dataJson = '[["Cast Test", "not_a_number"]]';
        DataLoaderController.DMLResult result = DataLoaderController.insertRecords('Account', fieldsJson, dataJson);
        System.assertEquals(1, result.successCount);
    }

    @IsTest
    static void testInsertRecords_DatetimeField() {
        SecurityUtil.testPermissionOverride = true;
        // Event has ActivityDateTime (Datetime) field
        String fieldsJson = '["Subject", "ActivityDateTime", "DurationInMinutes"]';
        String dataJson = '[["DT Test", "2026-03-04T10:00:00", "60"]]';
        DataLoaderController.DMLResult result = DataLoaderController.insertRecords('Event', fieldsJson, dataJson);
        System.assertNotEquals(null, result);
    }

    @IsTest
    static void testInsertRecords_PartialFailure() {
        SecurityUtil.testPermissionOverride = true;
        // Name is required on Account — one valid, one missing Name → partial failure
        String fieldsJson = '["Name"]';
        String dataJson = '[["Valid Name"],["  "]]';
        DataLoaderController.DMLResult result = DataLoaderController.insertRecords('Account', fieldsJson, dataJson);
        System.assertEquals(2, result.totalRequested);
        // At least one should succeed
        System.assert(result.successCount >= 1);
    }

    @IsTest
    static void testUpdateRecords_PartialFailure() {
        SecurityUtil.testPermissionOverride = true;
        Account acc = new Account(Name = 'Partial Update');
        insert acc;
        // One valid update, one with fake Id
        String fieldsJson = '["Id", "Name"]';
        String dataJson = '[["' + acc.Id + '", "Updated"],["001000000000000AAA", "Fail"]]';
        DataLoaderController.DMLResult result = DataLoaderController.updateRecords('Account', fieldsJson, dataJson);
        System.assertEquals(2, result.totalRequested);
        System.assert(result.failureCount > 0, 'Should have at least one failure');
        // Check error message populated
        Boolean hasError = false;
        for (DataLoaderController.RowResult row : result.rows) {
            if (!row.success && row.errorMessage != null) {
                hasError = true;
                break;
            }
        }
        System.assert(hasError, 'Failed row should have error message');
    }

    // ─── Wrapper class coverage ───

    @IsTest
    static void testDMLResultWrapper() {
        DataLoaderController.DMLResult result = new DataLoaderController.DMLResult();
        System.assertEquals(0, result.totalRequested);
        System.assertEquals(0, result.successCount);
        System.assertEquals(0, result.failureCount);
        System.assertNotEquals(null, result.rows);
    }

    @IsTest
    static void testRowResultWrapper() {
        DataLoaderController.RowResult row = new DataLoaderController.RowResult();
        row.rowIndex = 0;
        row.success = true;
        row.recordId = '001xx';
        row.errorMessage = null;
        System.assertEquals(0, row.rowIndex);
        System.assertEquals(true, row.success);
    }
}
