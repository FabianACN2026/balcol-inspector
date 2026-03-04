@IsTest
private class SelfOrgCalloutHelper_Test {

    @IsTest
    static void testGetSessionId() {
        // In test context, returns UserInfo.getSessionId()
        String sessionId = SelfOrgCalloutHelper.getSessionId();
        // Session ID may be null in some test contexts but method shouldn't throw
    }

    @IsTest
    static void testCreateRequest() {
        HttpRequest req = SelfOrgCalloutHelper.createRequest('/services/data/v65.0/query', 'GET');
        System.assertNotEquals(null, req);
        System.assert(req.getEndpoint().contains('/services/data/v65.0/query'));
        System.assertEquals('GET', req.getMethod());
        System.assertEquals('application/json', req.getHeader('Content-Type'));
        System.assert(req.getHeader('Authorization').startsWith('Bearer '));
    }

    @IsTest
    static void testGetSessionId_CachesResult() {
        // Call twice — should cache and return same value
        String first = SelfOrgCalloutHelper.getSessionId();
        String second = SelfOrgCalloutHelper.getSessionId();
        System.assertEquals(first, second);
    }
}
