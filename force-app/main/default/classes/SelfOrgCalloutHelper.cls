public with sharing class SelfOrgCalloutHelper {

    private static String cachedSessionId;

    public static String getSessionId() {
        if (cachedSessionId != null) {
            return cachedSessionId;
        }
        if (Test.isRunningTest()) {
            cachedSessionId = UserInfo.getSessionId();
            return cachedSessionId;
        }
        try {
            cachedSessionId = Page.DevToolsSessionId.getContent().toString().trim();
        } catch (Exception e) {
            cachedSessionId = UserInfo.getSessionId();
        }
        return cachedSessionId;
    }

    @SuppressWarnings('PMD.ApexSuggestUsingNamedCred')
    public static HttpRequest createRequest(String path, String method) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(URL.getOrgDomainUrl().toExternalForm() + path);
        req.setMethod(method);
        req.setHeader('Authorization', 'Bearer ' + getSessionId());
        req.setHeader('Content-Type', 'application/json');
        return req;
    }
}
