@IsTest
private class MetadataBrowserController_Test {

    @IsTest
    static void testGetAccessibleObjects_NoSearch() {
        List<MetadataBrowserController.ObjectSummary> objects = MetadataBrowserController.getAccessibleObjects(null);
        System.assert(objects.size() > 0, 'Should return accessible objects');
        // Verify wrapper properties are populated
        MetadataBrowserController.ObjectSummary first = objects[0];
        System.assertNotEquals(null, first.apiName);
        System.assertNotEquals(null, first.label);
    }

    @IsTest
    static void testGetAccessibleObjects_WithSearch() {
        List<MetadataBrowserController.ObjectSummary> objects = MetadataBrowserController.getAccessibleObjects('Account');
        System.assert(objects.size() > 0);
        // All results should contain 'Account' in API name or label
        for (MetadataBrowserController.ObjectSummary obj : objects) {
            System.assert(
                obj.apiName.containsIgnoreCase('Account') ||
                (obj.label != null && obj.label.containsIgnoreCase('Account')),
                'Result should match search term: ' + obj.apiName
            );
        }
    }

    @IsTest
    static void testGetAccessibleObjects_EmptySearch() {
        List<MetadataBrowserController.ObjectSummary> objects = MetadataBrowserController.getAccessibleObjects('');
        System.assert(objects.size() > 0);
    }

    @IsTest
    static void testGetAccessibleObjects_NoResults() {
        List<MetadataBrowserController.ObjectSummary> objects = MetadataBrowserController.getAccessibleObjects('xyznonexistent12345');
        System.assertEquals(0, objects.size());
    }

    @IsTest
    static void testGetObjectDetail() {
        MetadataBrowserController.ObjectDetail detail = MetadataBrowserController.getObjectDetail('Account');
        System.assertNotEquals(null, detail);
        System.assertEquals('Account', detail.apiName);
        System.assert(detail.fields.size() > 0);
        System.assert(detail.fieldCount > 0);
        // Account has child relationships
        System.assert(detail.relationships.size() > 0);

        // Verify field info structure
        MetadataBrowserController.FieldInfo field = detail.fields[0];
        System.assertNotEquals(null, field.apiName);
        System.assertNotEquals(null, field.type);
    }

    @IsTest
    static void testGetObjectDetail_InvalidObject() {
        try {
            MetadataBrowserController.getObjectDetail('NonExistentObject__xyz');
            System.assert(false, 'Expected exception');
        } catch (SecurityUtil.SecurityException e) {
            System.assert(e.getMessage().contains('Invalid object'), e.getMessage());
        }
    }

    @IsTest
    static void testObjectSummaryWrapper() {
        List<MetadataBrowserController.ObjectSummary> objects = MetadataBrowserController.getAccessibleObjects('Contact');
        Boolean foundContact = false;
        for (MetadataBrowserController.ObjectSummary obj : objects) {
            if (obj.apiName == 'Contact') {
                foundContact = true;
                System.assertNotEquals(null, obj.keyPrefix);
                break;
            }
        }
    }

    @IsTest
    static void testRelationshipInfoWrapper() {
        MetadataBrowserController.ObjectDetail detail = MetadataBrowserController.getObjectDetail('Account');
        if (!detail.relationships.isEmpty()) {
            MetadataBrowserController.RelationshipInfo rel = detail.relationships[0];
            System.assertNotEquals(null, rel.relationshipName);
            System.assertNotEquals(null, rel.childObject);
            System.assertNotEquals(null, rel.fieldName);
        }
    }
}
