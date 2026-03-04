@IsTest
private class RecordInspectorController_Test {

    @TestSetup
    static void setupTestData() {
        Account acc = new Account(Name = 'Test Inspector Account');
        insert acc;
        Contact con = new Contact(FirstName = 'Test', LastName = 'Contact', AccountId = acc.Id);
        insert con;
    }

    private static Account getTestAccount() {
        return [SELECT Id, Name FROM Account ORDER BY CreatedDate DESC LIMIT 1];
    }

    private static Contact getTestContact() {
        return [SELECT Id FROM Contact ORDER BY CreatedDate DESC LIMIT 1];
    }

    // ── getRecordData ───────────────────────────────────────────────────

    @IsTest
    static void testGetRecordData_Account() {
        Account acc = getTestAccount();
        RecordInspectorController.RecordData data = RecordInspectorController.getRecordData(acc.Id);
        System.assertNotEquals(null, data);
        System.assertEquals('Account', data.objectApiName);
        System.assertEquals(String.valueOf(acc.Id), data.recordId);
        System.assert(data.fields.size() > 0);
        System.assert(data.fieldCount > 0);
        System.assertNotEquals(null, data.createdDate);
        System.assertNotEquals(null, data.lastModifiedDate);
    }

    @IsTest
    static void testGetRecordData_Contact() {
        Contact con = getTestContact();
        RecordInspectorController.RecordData data = RecordInspectorController.getRecordData(con.Id);
        System.assertNotEquals(null, data);
        System.assertEquals('Contact', data.objectApiName);
    }

    @IsTest
    static void testGetRecordData_InvalidId() {
        try {
            RecordInspectorController.getRecordData('001000000000000AAA');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
    }

    // ── deleteRecord ────────────────────────────────────────────────────

    @IsTest
    static void testDeleteRecord() {
        Account acc = new Account(Name = 'Delete Me');
        insert acc;
        RecordInspectorController.deleteRecord(acc.Id);
        List<Account> remaining = [SELECT Id FROM Account WHERE Id = :acc.Id];
        System.assertEquals(0, remaining.size());
    }

    // ── bulkDeleteRecords ───────────────────────────────────────────────

    @IsTest
    static void testBulkDeleteRecords() {
        List<Account> accs = new List<Account>();
        for (Integer i = 0; i < 5; i++) {
            accs.add(new Account(Name = 'Bulk Delete ' + i));
        }
        insert accs;
        List<Id> ids = new List<Id>();
        for (Account a : accs) {
            ids.add(a.Id);
        }

        RecordInspectorController.BulkDeleteResult result = RecordInspectorController.bulkDeleteRecords(ids);
        System.assertEquals(5, result.totalRequested);
        System.assertEquals(5, result.successCount);
        System.assertEquals(0, result.failureCount);
    }

    @IsTest
    static void testBulkDeleteRecords_Empty() {
        RecordInspectorController.BulkDeleteResult result = RecordInspectorController.bulkDeleteRecords(new List<Id>());
        System.assertEquals(0, result.totalRequested);
    }

    // ── cascadeDeleteRecord ─────────────────────────────────────────────

    @IsTest
    static void testCascadeDeleteRecord() {
        Account acc = new Account(Name = 'Cascade Parent');
        insert acc;
        Contact con = new Contact(FirstName = 'Child', LastName = 'Record', AccountId = acc.Id);
        insert con;

        RecordInspectorController.BulkDeleteResult result = RecordInspectorController.cascadeDeleteRecord(acc.Id);
        System.assertNotEquals(null, result);
        // Parent should be deleted
        System.assert(result.successIds.size() > 0);
    }

    // ── hasChildRelationships ───────────────────────────────────────────

    @IsTest
    static void testHasChildRelationships() {
        Account acc = getTestAccount();
        Boolean hasChildren = RecordInspectorController.hasChildRelationships(acc.Id);
        // Account always has child relationships (Contact, Opportunity, etc.)
        System.assertEquals(true, hasChildren);
    }

    // ── getChildRelationships ───────────────────────────────────────────

    @IsTest
    static void testGetChildRelationships() {
        // Create fresh data to ensure parent-child link
        Account acc = new Account(Name = 'ChildRel Test');
        insert acc;
        insert new Contact(FirstName = 'CR', LastName = 'Test', AccountId = acc.Id);

        List<RecordInspectorController.ChildRelationshipInfo> rels = RecordInspectorController.getChildRelationships(acc.Id);
        System.assert(rels.size() > 0, 'Account should have child relationships');
        // Verify at least one relationship has records
        Boolean foundWithRecords = false;
        for (RecordInspectorController.ChildRelationshipInfo rel : rels) {
            if (rel.recordCount > 0) {
                foundWithRecords = true;
                break;
            }
        }
        System.assert(foundWithRecords, 'Should find at least one child relationship with records');
    }

    // ── getRecordHistory ────────────────────────────────────────────────

    @IsTest
    static void testGetRecordHistory() {
        Account acc = getTestAccount();
        // Update account to potentially create history
        acc.Name = 'Updated Name';
        update acc;
        List<RecordInspectorController.FieldHistoryItem> items = RecordInspectorController.getRecordHistory(acc.Id);
        // May be empty if field history tracking not enabled — just verify no exception
        System.assertNotEquals(null, items);
    }

    @IsTest
    static void testGetRecordHistory_Contact() {
        Contact con = getTestContact();
        List<RecordInspectorController.FieldHistoryItem> items = RecordInspectorController.getRecordHistory(con.Id);
        System.assertNotEquals(null, items);
    }

    // ── updateRecordFields ──────────────────────────────────────────────

    @IsTest
    static void testUpdateRecordFields() {
        Account acc = getTestAccount();
        String updates = '{"Name": "Updated Inspector Account"}';
        Map<String, Object> result = RecordInspectorController.updateRecordFields(acc.Id, updates);
        System.assertEquals(true, result.get('success'));

        Account updated = [SELECT Name FROM Account WHERE Id = :acc.Id];
        System.assertEquals('Updated Inspector Account', updated.Name);
    }

    @IsTest
    static void testUpdateRecordFields_NoChanges() {
        Account acc = getTestAccount();
        String updates = '{}';
        Map<String, Object> result = RecordInspectorController.updateRecordFields(acc.Id, updates);
        System.assertEquals(true, result.get('success'));
    }

    // ── updateRecordFields error paths ───────────────────────────────────

    @IsTest
    static void testUpdateRecordFields_InvalidField() {
        Account acc = getTestAccount();
        // Non-updateable or non-existent field — should be silently skipped
        String updates = '{"NonExistentField__xyz": "value"}';
        Map<String, Object> result = RecordInspectorController.updateRecordFields(acc.Id, updates);
        System.assertEquals(true, result.get('success'));
    }

    // ── deleteRecord error paths ──────────────────────────────────────────

    @IsTest
    static void testDeleteRecord_InvalidId() {
        try {
            RecordInspectorController.deleteRecord('001000000000000AAA');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: DmlException wrapped in AuraHandledException
        }
    }

    // ── bulkDeleteRecords with partial failures ───────────────────────────

    @IsTest
    static void testBulkDeleteRecords_InvalidIds() {
        // Fake IDs that don't exist — should produce failures
        List<Id> fakeIds = new List<Id>();
        fakeIds.add('001000000000001AAA');
        fakeIds.add('001000000000002AAA');
        RecordInspectorController.BulkDeleteResult result = RecordInspectorController.bulkDeleteRecords(fakeIds);
        System.assertEquals(2, result.totalRequested);
        System.assert(result.failureCount > 0, 'Should have failures for non-existent records');
        System.assert(result.errors.size() > 0);
    }

    // ── getRecordHistory edge cases ───────────────────────────────────────

    @IsTest
    static void testGetRecordHistory_NonStandardObject() {
        // Use a custom object or object without history tracking
        Account acc = getTestAccount();
        List<RecordInspectorController.FieldHistoryItem> items = RecordInspectorController.getRecordHistory(acc.Id);
        // Should return empty list without throwing (history may not be enabled)
        System.assertNotEquals(null, items);
    }

    // ── Wrapper class properties ────────────────────────────────────────

    @IsTest
    static void testRecordDataWrapper() {
        Account acc = getTestAccount();
        RecordInspectorController.RecordData data = RecordInspectorController.getRecordData(acc.Id);
        // Verify field metadata properties are populated
        for (RecordInspectorController.FieldMetadata field : data.fields) {
            System.assertNotEquals(null, field.apiName);
            System.assertNotEquals(null, field.type);
            break; // Just check first field to save execution time
        }
    }

    @IsTest
    static void testRecordDataWrapper_AuditFields() {
        Account acc = getTestAccount();
        RecordInspectorController.RecordData data = RecordInspectorController.getRecordData(acc.Id);
        System.assertNotEquals(null, data.createdByName);
        System.assertNotEquals(null, data.lastModifiedByName);
    }
}
