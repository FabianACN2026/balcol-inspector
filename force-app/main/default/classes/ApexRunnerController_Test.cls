@IsTest
private class ApexRunnerController_Test {

    // Multi-response mock that handles different endpoints
    private class ApexRunnerMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            String endpoint = req.getEndpoint();

            if (endpoint.contains('executeAnonymous')) {
                res.setStatusCode(200);
                res.setBody('{"compiled":true,"success":true,"compileProblem":null,"exceptionMessage":null,"exceptionStackTrace":null,"line":-1,"column":-1}');
            } else if (endpoint.contains('ApexLog') && endpoint.contains('Body')) {
                res.setStatusCode(200);
                res.setBody('14:30:00.0 (12345)|USER_DEBUG|[3]|DEBUG|Hello World\n14:30:00.1 (12346)|USER_DEBUG|[5]|INFO|Test output');
            } else if (endpoint.contains('ApexLog') && req.getMethod() == 'GET') {
                // getRecentLogs or getExecutionLog query
                res.setStatusCode(200);
                res.setBody('{"totalSize":1,"done":true,"records":[{"Id":"07Lxx0000000001","Application":"Browser","DurationMilliseconds":100,"Location":"SystemLog","LogLength":500,"LogUser":{"Name":"Test User"},"Operation":"Api","Request":"POST","StartTime":"2026-03-04T12:00:00.000+0000","Status":"Success"}]}');
            } else if (endpoint.contains('DebugLevel')) {
                if (req.getMethod() == 'GET') {
                    res.setStatusCode(200);
                    res.setBody('{"totalSize":1,"done":true,"records":[{"Id":"7dlxx0000000001"}]}');
                } else {
                    res.setStatusCode(201);
                    res.setBody('{"id":"7dlxx0000000001","success":true}');
                }
            } else if (endpoint.contains('TraceFlag')) {
                if (req.getMethod() == 'GET') {
                    // Return expired trace flag
                    res.setStatusCode(200);
                    res.setBody('{"totalSize":1,"done":true,"records":[{"Id":"7tfxx0000000001","ExpirationDate":"2020-01-01T00:00:00.000+0000"}]}');
                } else {
                    res.setStatusCode(204);
                    res.setBody('');
                }
            } else {
                res.setStatusCode(200);
                res.setBody('{}');
            }
            return res;
        }
    }

    private class FailMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(500);
            res.setBody('{"message":"Internal Server Error"}');
            return res;
        }
    }

    private class CompileErrorMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setBody('{"compiled":false,"success":false,"compileProblem":"Variable does not exist: x","exceptionMessage":null,"exceptionStackTrace":null,"line":1,"column":5}');
            return res;
        }
    }

    // ─── ensureTraceFlag ───

    @IsTest
    static void testEnsureTraceFlag() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new ApexRunnerMock());
        Test.startTest();
        // Should not throw — non-critical
        ApexRunnerController.ensureTraceFlag();
        Test.stopTest();
    }

    @IsTest
    static void testEnsureTraceFlag_NoPermission() {
        SecurityUtil.testPermissionOverride = false;
        // Should silently skip
        ApexRunnerController.ensureTraceFlag();
    }

    // ─── executeAnonymousApex ───

    @IsTest
    static void testExecuteAnonymousApex_Success() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new ApexRunnerMock());
        Test.startTest();
        ApexRunnerController.ExecutionResult result = ApexRunnerController.executeAnonymousApex('System.debug(\'Hello\');');
        Test.stopTest();
        System.assertEquals(true, result.compiled);
        System.assertEquals(true, result.success);
    }

    @IsTest
    static void testExecuteAnonymousApex_CompileError() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new CompileErrorMock());
        Test.startTest();
        ApexRunnerController.ExecutionResult result = ApexRunnerController.executeAnonymousApex('Integer x = ;');
        Test.stopTest();
        System.assertEquals(false, result.compiled);
        System.assertNotEquals(null, result.compileProblem);
        System.assertEquals(1, result.line);
    }

    @IsTest
    static void testExecuteAnonymousApex_NoPermission() {
        SecurityUtil.testPermissionOverride = false;
        try {
            ApexRunnerController.executeAnonymousApex('System.debug(1);');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
    }

    @IsTest
    static void testExecuteAnonymousApex_EmptyCode() {
        SecurityUtil.testPermissionOverride = true;
        try {
            ApexRunnerController.executeAnonymousApex('');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
    }

    @IsTest
    static void testExecuteAnonymousApex_TooLong() {
        SecurityUtil.testPermissionOverride = true;
        String longCode = 'a'.repeat(100001);
        try {
            ApexRunnerController.executeAnonymousApex(longCode);
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
    }

    @IsTest
    static void testExecuteAnonymousApex_HttpError() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new FailMock());
        Test.startTest();
        try {
            ApexRunnerController.executeAnonymousApex('System.debug(1);');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
        Test.stopTest();
    }

    // ─── getRecentLogs ───

    @IsTest
    static void testGetRecentLogs() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new ApexRunnerMock());
        Test.startTest();
        List<ApexRunnerController.DebugLogInfo> logs = ApexRunnerController.getRecentLogs(10);
        Test.stopTest();
        System.assertNotEquals(null, logs);
        System.assert(logs.size() > 0);
        System.assertNotEquals(null, logs[0].id);
    }

    @IsTest
    static void testGetRecentLogs_DefaultLimit() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new ApexRunnerMock());
        Test.startTest();
        List<ApexRunnerController.DebugLogInfo> logs = ApexRunnerController.getRecentLogs(null);
        Test.stopTest();
        System.assertNotEquals(null, logs);
    }

    @IsTest
    static void testGetRecentLogs_NoPermission() {
        SecurityUtil.testPermissionOverride = false;
        try {
            ApexRunnerController.getRecentLogs(10);
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
    }

    // ─── getLogBody ───

    @IsTest
    static void testGetLogBody() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new ApexRunnerMock());
        Test.startTest();
        String body = ApexRunnerController.getLogBody('07Lxx0000000001');
        Test.stopTest();
        System.assertNotEquals(null, body);
    }

    @IsTest
    static void testGetLogBody_Empty() {
        SecurityUtil.testPermissionOverride = true;
        try {
            ApexRunnerController.getLogBody('');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
    }

    // ─── getExecutionLog ───

    @IsTest
    static void testGetExecutionLog() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new ApexRunnerMock());
        Test.startTest();
        ApexRunnerController.ExecutionLog log = ApexRunnerController.getExecutionLog('2026-03-04T12:00:00.000Z');
        Test.stopTest();
        System.assertNotEquals(null, log);
        System.assertNotEquals(null, log.logId);
    }

    @IsTest
    static void testGetExecutionLog_Blank() {
        SecurityUtil.testPermissionOverride = true;
        ApexRunnerController.ExecutionLog log = ApexRunnerController.getExecutionLog('');
        System.assertEquals(null, log);
    }

    @IsTest
    static void testGetExecutionLog_NoPermission() {
        SecurityUtil.testPermissionOverride = false;
        try {
            ApexRunnerController.getExecutionLog('2026-03-04T12:00:00.000Z');
            System.assert(false, 'Expected exception');
        } catch (Exception e) {
            // Expected: AuraHandledException thrown
        }
    }

    // ─── ensureTraceFlag edge cases ───

    // Mock: no trace flags exist → triggers create branch (lines 91-111)
    private class NoTraceFlagMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            String endpoint = req.getEndpoint();
            if (endpoint.contains('DebugLevel')) {
                if (req.getMethod() == 'GET') {
                    res.setStatusCode(200);
                    res.setBody('{"totalSize":1,"done":true,"records":[{"Id":"7dlxx0000000001"}]}');
                } else {
                    res.setStatusCode(201);
                    res.setBody('{"id":"7dlxx0000000001","success":true}');
                }
            } else if (endpoint.contains('TraceFlag')) {
                if (req.getMethod() == 'GET') {
                    // Empty — no existing trace flag
                    res.setStatusCode(200);
                    res.setBody('{"totalSize":0,"done":true,"records":[]}');
                } else {
                    res.setStatusCode(201);
                    res.setBody('{"id":"7tfxx0000000002","success":true}');
                }
            } else {
                res.setStatusCode(200);
                res.setBody('{}');
            }
            return res;
        }
    }

    // Mock: active (non-expired) trace flag → triggers early return (line 71)
    private class ActiveTraceFlagMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            String endpoint = req.getEndpoint();
            if (endpoint.contains('DebugLevel')) {
                res.setStatusCode(200);
                res.setBody('{"totalSize":1,"done":true,"records":[{"Id":"7dlxx0000000001"}]}');
            } else if (endpoint.contains('TraceFlag')) {
                res.setStatusCode(200);
                res.setBody('{"totalSize":1,"done":true,"records":[{"Id":"7tfxx0000000001","ExpirationDate":"2099-01-01T00:00:00.000+0000"}]}');
            } else {
                res.setStatusCode(200);
                res.setBody('{}');
            }
            return res;
        }
    }

    // Mock: DebugLevel query fails AND create fails → null debugLevelId (line 29)
    private class NullDebugLevelMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            String endpoint = req.getEndpoint();
            if (endpoint.contains('DebugLevel')) {
                res.setStatusCode(400);
                res.setBody('{"message":"Bad Request"}');
            } else {
                res.setStatusCode(200);
                res.setBody('{}');
            }
            return res;
        }
    }

    // Mock: TraceFlag query returns non-200 → triggers line 47
    private class TraceFlagQueryFailMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            String endpoint = req.getEndpoint();
            if (endpoint.contains('DebugLevel')) {
                res.setStatusCode(200);
                res.setBody('{"totalSize":1,"done":true,"records":[{"Id":"7dlxx0000000001"}]}');
            } else if (endpoint.contains('TraceFlag')) {
                res.setStatusCode(400);
                res.setBody('{"message":"Bad Request"}');
            } else {
                res.setStatusCode(200);
                res.setBody('{}');
            }
            return res;
        }
    }

    @IsTest
    static void testEnsureTraceFlag_NoExistingTraceFlag() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new NoTraceFlagMock());
        Test.startTest();
        ApexRunnerController.ensureTraceFlag();
        Test.stopTest();
    }

    @IsTest
    static void testEnsureTraceFlag_ActiveTraceFlag() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new ActiveTraceFlagMock());
        Test.startTest();
        ApexRunnerController.ensureTraceFlag();
        Test.stopTest();
    }

    @IsTest
    static void testEnsureTraceFlag_NullDebugLevel() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new NullDebugLevelMock());
        Test.startTest();
        ApexRunnerController.ensureTraceFlag();
        Test.stopTest();
    }

    @IsTest
    static void testEnsureTraceFlag_TraceFlagQueryFail() {
        SecurityUtil.testPermissionOverride = true;
        Test.setMock(HttpCalloutMock.class, new TraceFlagQueryFailMock());
        Test.startTest();
        ApexRunnerController.ensureTraceFlag();
        Test.stopTest();
    }

    @IsTest
    static void testEnsureTraceFlag_HttpException() {
        SecurityUtil.testPermissionOverride = true;
        // FailMock returns 500 for everything — triggers outer catch (lines 112-118)
        Test.setMock(HttpCalloutMock.class, new FailMock());
        Test.startTest();
        ApexRunnerController.ensureTraceFlag();
        Test.stopTest();
    }

    // ─── extractDebugOutput (TestVisible) ───

    @IsTest
    static void testExtractDebugOutput() {
        String logBody = '14:30:00.0 (12345)|USER_DEBUG|[3]|DEBUG|Hello World\n14:30:00.1 (12346)|SYSTEM_METHOD_ENTRY|[4]|String.valueOf\n14:30:00.2 (12347)|USER_DEBUG|[5]|INFO|Second line';
        String output = ApexRunnerController.extractDebugOutput(logBody);
        System.assert(output.contains('Hello World'));
        System.assert(output.contains('Second line'));
    }

    @IsTest
    static void testExtractDebugOutput_Empty() {
        System.assertEquals('', ApexRunnerController.extractDebugOutput(''));
        System.assertEquals('', ApexRunnerController.extractDebugOutput(null));
    }

    @IsTest
    static void testExtractDebugOutput_NoDebugLines() {
        System.assertEquals('', ApexRunnerController.extractDebugOutput('Some random log content without debug'));
    }
}
