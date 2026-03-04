/**
 * @description Controller for Apex Runner module
 *              Executes anonymous Apex via Tooling API using session-based auth
 * @group Developer Tools
 */
public with sharing class ApexRunnerController {
  private static final Integer MAX_CODE_LENGTH = 100000;
  private static final String TOOLING_API_VERSION = 'v65.0';
  private static final Pattern DEBUG_PATTERN = Pattern.compile('USER_DEBUG\\|\\[\\d+\\]\\|\\w+\\|(.*)');

  /**
   * Ensure a trace flag exists for the current user so debug logs are captured.
   * Creates a DebugLevel and TraceFlag via Tooling API if needed.
   * Called automatically before execution and available to LWC on tab load.
   */
  @AuraEnabled
  public static void ensureTraceFlag() {
    if (!SecurityUtil.hasPowerToolsPermission()) {
      return; // Silently skip — non-critical setup, no need to throw
    }

    try {
      String userId = UserInfo.getUserId();
      Http http = new Http();

      // Step 1: Find or create a DebugLevel
      String debugLevelId = getOrCreateDebugLevel(http);
      if (debugLevelId == null) {
        return; // Non-critical — execution still works, just no logs
      }

      // Step 2: Check for active trace flag
      String tfQuery =
        'SELECT+Id,ExpirationDate+FROM+TraceFlag+WHERE+TracedEntityId=\'' +
        userId +
        '\'+AND+LogType=\'DEVELOPER_LOG\'+ORDER+BY+ExpirationDate+DESC+LIMIT+1';
      HttpRequest tfReq = SelfOrgCalloutHelper.createRequest(
        '/services/data/' +
          TOOLING_API_VERSION +
          '/tooling/query/?q=' +
          tfQuery,
        'GET'
      );
      HttpResponse tfRes = http.send(tfReq);

      if (tfRes.getStatusCode() != 200) {
        return;
      }

      Map<String, Object> tfData = (Map<String, Object>) JSON.deserializeUntyped(
        tfRes.getBody()
      );
      List<Object> tfRecords = (List<Object>) tfData.get('records');

      String nowISO = Datetime.now()
        .formatGmt('yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'');
      String expISO = Datetime.now()
        .addMinutes(30)
        .formatGmt('yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'');

      if (tfRecords != null && !tfRecords.isEmpty()) {
        // Check if expired
        Map<String, Object> existing = (Map<String, Object>) tfRecords[0];
        String expDate = (String) existing.get('ExpirationDate');
        if (
          expDate != null &&
          Datetime.valueOfGmt(
            expDate.replace('T', ' ').replace('.000+0000', '')
          ) > Datetime.now()
        ) {
          return; // Still active — nothing to do
        }
        // Expired — update it
        String tfId = (String) existing.get('Id');
        HttpRequest updateReq = SelfOrgCalloutHelper.createRequest(
          '/services/data/' +
            TOOLING_API_VERSION +
            '/tooling/sobjects/TraceFlag/' +
            tfId,
          'PATCH'
        );
        updateReq.setBody(
          JSON.serialize(
            new Map<String, Object>{
              'StartDate' => nowISO,
              'ExpirationDate' => expISO
            }
          )
        );
        http.send(updateReq);
      } else {
        // No trace flag — create one
        HttpRequest createReq = SelfOrgCalloutHelper.createRequest(
          '/services/data/' +
            TOOLING_API_VERSION +
            '/tooling/sobjects/TraceFlag/',
          'POST'
        );
        createReq.setBody(
          JSON.serialize(
            new Map<String, Object>{
              'TracedEntityId' => userId,
              'DebugLevelId' => debugLevelId,
              'LogType' => 'DEVELOPER_LOG',
              'StartDate' => nowISO,
              'ExpirationDate' => expISO
            }
          )
        );
        http.send(createReq);
      }
    } catch (Exception e) {
      // Non-critical — trace flag setup failure doesn't block execution
      System.debug(
        LoggingLevel.WARN,
        'TraceFlag setup failed (non-critical): ' + e.getMessage()
      );
    }
  }

  /**
   * Find an existing DebugLevel or create one
   */
  private static String getOrCreateDebugLevel(Http http) {
    // Try to find any existing debug level
    HttpRequest dlReq = SelfOrgCalloutHelper.createRequest(
      '/services/data/' +
        TOOLING_API_VERSION +
        '/tooling/query/?q=SELECT+Id+FROM+DebugLevel+LIMIT+1',
      'GET'
    );
    HttpResponse dlRes = http.send(dlReq);

    if (dlRes.getStatusCode() == 200) {
      Map<String, Object> dlData = (Map<String, Object>) JSON.deserializeUntyped(
        dlRes.getBody()
      );
      List<Object> dlRecords = (List<Object>) dlData.get('records');
      if (dlRecords != null && !dlRecords.isEmpty()) {
        return (String) ((Map<String, Object>) dlRecords[0]).get('Id');
      }
    }

    // None found — create one
    HttpRequest createDl = SelfOrgCalloutHelper.createRequest(
      '/services/data/' + TOOLING_API_VERSION + '/tooling/sobjects/DebugLevel/',
      'POST'
    );
    createDl.setBody(
      JSON.serialize(
        new Map<String, Object>{
          'DeveloperName' => 'ABN_DevTools_Debug',
          'MasterLabel' => 'ABN DevTools Debug',
          'ApexCode' => 'DEBUG',
          'ApexProfiling' => 'NONE',
          'Callout' => 'NONE',
          'Database' => 'NONE',
          'System' => 'NONE',
          'Validation' => 'NONE',
          'Visualforce' => 'NONE',
          'Workflow' => 'NONE'
        }
      )
    );
    HttpResponse createDlRes = http.send(createDl);

    if (createDlRes.getStatusCode() == 201) {
      Map<String, Object> created = (Map<String, Object>) JSON.deserializeUntyped(
        createDlRes.getBody()
      );
      return (String) created.get('id');
    }

    return null;
  }

  /**
   * Execute anonymous Apex code via Tooling API
   * @param code The Apex code to execute
   * @return ExecutionResult with compiled status, success, and any errors
   */
  @AuraEnabled
  public static ExecutionResult executeAnonymousApex(String code) {
    if (!SecurityUtil.hasPowerToolsPermission()) {
      throw new AuraHandledException(
        'You do not have permission to use the Apex Runner. Contact your administrator to assign the Dev Tools Power permission set.'
      );
    }

    if (String.isBlank(code)) {
      throw new AuraHandledException('Apex code cannot be empty');
    }

    if (code.length() > MAX_CODE_LENGTH) {
      throw new AuraHandledException(
        'Code exceeds maximum length of ' + MAX_CODE_LENGTH + ' characters'
      );
    }

    try {
      String encodedBody = EncodingUtil.urlEncode(code, 'UTF-8');
      HttpRequest req = SelfOrgCalloutHelper.createRequest(
        '/services/data/' +
          TOOLING_API_VERSION +
          '/tooling/executeAnonymous/?anonymousBody=' +
          encodedBody,
        'GET'
      );
      req.setTimeout(120000); // 2 minute timeout for long-running code

      Http http = new Http();
      HttpResponse res = http.send(req);

      if (res.getStatusCode() != 200) {
        throw new AuraHandledException(
          'Tooling API error (HTTP ' +
            res.getStatusCode() +
            '): ' +
            res.getBody()
        );
      }

      Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(
        res.getBody()
      );

      ExecutionResult result = new ExecutionResult();
      result.compiled = (Boolean) responseMap.get('compiled');
      result.success = (Boolean) responseMap.get('success');
      result.compileProblem = (String) responseMap.get('compileProblem');
      result.exceptionMessage = (String) responseMap.get('exceptionMessage');
      result.exceptionStackTrace = (String) responseMap.get(
        'exceptionStackTrace'
      );
      result.line = responseMap.get('line') != null
        ? Integer.valueOf(responseMap.get('line'))
        : null;
      result.column = responseMap.get('column') != null
        ? Integer.valueOf(responseMap.get('column'))
        : null;

      return result;
    } catch (AuraHandledException e) {
      throw e;
    } catch (CalloutException e) {
      throw new AuraHandledException(
        'Tooling API callout failed: ' + e.getMessage()
      );
    }
  }

  /**
   * Get recent debug logs for the current user
   * @param limitCount Maximum number of logs to return
   * @return List of DebugLogInfo records
   */
  @AuraEnabled
  public static List<DebugLogInfo> getRecentLogs(Integer limitCount) {
    if (!SecurityUtil.hasPowerToolsPermission()) {
      throw new AuraHandledException(
        'You do not have permission to use the Apex Runner.'
      );
    }

    Integer logLimit = (limitCount != null &&
      limitCount > 0 &&
      limitCount <= 50)
      ? limitCount
      : 20;

    try {
      // Fetch extra rows to account for filtered-out framework noise
      Integer fetchLimit = Math.min(logLimit * 3, 100);
      String query =
        'SELECT+Id,Application,DurationMilliseconds,Location,LogLength,LogUser.Name,Operation,Request,StartTime,Status+FROM+ApexLog+ORDER+BY+StartTime+DESC+LIMIT+' +
        fetchLimit;
      HttpRequest req = SelfOrgCalloutHelper.createRequest(
        '/services/data/' + TOOLING_API_VERSION + '/tooling/query/?q=' + query,
        'GET'
      );

      Http http = new Http();
      HttpResponse res = http.send(req);

      if (res.getStatusCode() != 200) {
        throw new AuraHandledException(
          'Failed to fetch debug logs: ' + res.getBody()
        );
      }

      Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(
        res.getBody()
      );
      List<Object> records = (List<Object>) responseMap.get('records');

      List<DebugLogInfo> logs = new List<DebugLogInfo>();
      if (records != null) {
        for (Object record : records) {
          Map<String, Object> logMap = (Map<String, Object>) record;
          String operation = (String) logMap.get('Operation');

          // Skip Lightning framework and VF page noise
          if (
            operation != null &&
            (operation.startsWith('/aura') || operation.startsWith('/apex/'))
          ) {
            continue;
          }

          DebugLogInfo log = new DebugLogInfo();
          log.id = (String) logMap.get('Id');
          log.application = (String) logMap.get('Application');
          log.durationMs = logMap.get('DurationMilliseconds') != null
            ? Integer.valueOf(logMap.get('DurationMilliseconds'))
            : 0;
          log.location = (String) logMap.get('Location');
          log.logLength = logMap.get('LogLength') != null
            ? Integer.valueOf(logMap.get('LogLength'))
            : 0;
          log.operation = operation;
          log.request = (String) logMap.get('Request');
          log.startTime = (String) logMap.get('StartTime');
          log.status = (String) logMap.get('Status');

          Map<String, Object> logUser = (Map<String, Object>) logMap.get(
            'LogUser'
          );
          if (logUser != null) {
            log.userName = (String) logUser.get('Name');
          }
          logs.add(log);

          if (logs.size() >= logLimit) {
            break;
          }
        }
      }

      return logs;
    } catch (AuraHandledException e) {
      throw e;
    } catch (CalloutException e) {
      throw new AuraHandledException(
        'Failed to fetch debug logs: ' + e.getMessage()
      );
    }
  }

  /**
   * Get a specific debug log body
   * @param logId The ApexLog Id
   * @return The raw log body text
   */
  @AuraEnabled
  public static String getLogBody(String logId) {
    if (!SecurityUtil.hasPowerToolsPermission()) {
      throw new AuraHandledException(
        'You do not have permission to use the Apex Runner.'
      );
    }

    if (String.isBlank(logId)) {
      throw new AuraHandledException('Log ID is required');
    }

    try {
      HttpRequest req = SelfOrgCalloutHelper.createRequest(
        '/services/data/' +
          TOOLING_API_VERSION +
          '/tooling/sobjects/ApexLog/' +
          logId +
          '/Body',
        'GET'
      );

      Http http = new Http();
      HttpResponse res = http.send(req);

      if (res.getStatusCode() != 200) {
        throw new AuraHandledException(
          'Failed to fetch log body: HTTP ' + res.getStatusCode()
        );
      }

      return res.getBody();
    } catch (AuraHandledException e) {
      throw e;
    } catch (CalloutException e) {
      throw new AuraHandledException(
        'Failed to fetch log body: ' + e.getMessage()
      );
    }
  }

  /**
   * Fetch the execution log generated by the most recent anonymous execution.
   * Queries for the ApexLog created after the given timestamp for the current user,
   * fetches the log body, and extracts USER_DEBUG output lines.
   * @param afterTimestamp ISO 8601 timestamp — only logs after this time
   * @return ExecutionLog with debug output and full log, or null if no log found yet
   */
  @AuraEnabled
  public static ExecutionLog getExecutionLog(String afterTimestamp) {
    if (!SecurityUtil.hasPowerToolsPermission()) {
      throw new AuraHandledException(
        'You do not have permission to use the Apex Runner.'
      );
    }

    if (String.isBlank(afterTimestamp)) {
      return null;
    }

    try {
      Http http = new Http();
      String userId = UserInfo.getUserId();

      // Query the most recent API log for current user created after execution start
      // Filter to only API operations — excludes /aura and /apex/ framework noise
      String query =
        'SELECT+Id,DurationMilliseconds,Status,Operation+FROM+ApexLog' +
        '+WHERE+LogUser.Id=\'' +
        userId +
        '\'' +
        '+AND+StartTime>=' +
        EncodingUtil.urlEncode(afterTimestamp, 'UTF-8') +
        '+ORDER+BY+StartTime+DESC+LIMIT+5';

      HttpRequest req = SelfOrgCalloutHelper.createRequest(
        '/services/data/' + TOOLING_API_VERSION + '/tooling/query/?q=' + query,
        'GET'
      );
      HttpResponse res = http.send(req);

      if (res.getStatusCode() != 200) {
        return null;
      }

      Map<String, Object> data = (Map<String, Object>) JSON.deserializeUntyped(
        res.getBody()
      );
      List<Object> records = (List<Object>) data.get('records');

      if (records == null || records.isEmpty()) {
        return null;
      }

      // Find the first non-framework log (skip /aura and /apex/ noise)
      Map<String, Object> logRecord = null;
      for (Object rec : records) {
        Map<String, Object> candidate = (Map<String, Object>) rec;
        String op = (String) candidate.get('Operation');
        if (
          op == null || (!op.startsWith('/aura') && !op.startsWith('/apex/'))
        ) {
          logRecord = candidate;
          break;
        }
      }
      if (logRecord == null) {
        return null;
      }

      String logId = (String) logRecord.get('Id');

      // Fetch the log body
      HttpRequest bodyReq = SelfOrgCalloutHelper.createRequest(
        '/services/data/' +
          TOOLING_API_VERSION +
          '/tooling/sobjects/ApexLog/' +
          logId +
          '/Body',
        'GET'
      );
      HttpResponse bodyRes = http.send(bodyReq);

      if (bodyRes.getStatusCode() != 200) {
        return null;
      }

      String logBody = bodyRes.getBody();

      ExecutionLog execLog = new ExecutionLog();
      execLog.logId = logId;
      execLog.durationMs = logRecord.get('DurationMilliseconds') != null
        ? Integer.valueOf(logRecord.get('DurationMilliseconds'))
        : 0;
      execLog.status = (String) logRecord.get('Status');
      execLog.debugOutput = extractDebugOutput(logBody);
      execLog.fullLog = logBody;

      return execLog;
    } catch (Exception e) {
      // Non-critical — execution result is already returned separately
      return null;
    }
  }

  /**
   * Parse a raw debug log body and extract only USER_DEBUG output lines.
   * @param logBody Raw ApexLog body text
   * @return Extracted debug messages, one per line
   */
  @TestVisible
  private static String extractDebugOutput(String logBody) {
    if (String.isBlank(logBody)) {
      return '';
    }

    List<String> debugLines = new List<String>();

    for (String line : logBody.split('\n')) {
      if (!line.contains('USER_DEBUG')) {
        continue;
      }
      Matcher m = DEBUG_PATTERN.matcher(line);
      if (m.find()) {
        debugLines.add(m.group(1));
      }
    }

    return debugLines.isEmpty() ? '' : String.join(debugLines, '\n');
  }

  /**
   * Wrapper for execution log with parsed debug output
   */
  public class ExecutionLog {
    @AuraEnabled
    public String logId;
    @AuraEnabled
    public Integer durationMs;
    @AuraEnabled
    public String status;
    @AuraEnabled
    public String debugOutput;
    @AuraEnabled
    public String fullLog;
  }

  /**
   * Wrapper for anonymous execution result
   */
  public class ExecutionResult {
    @AuraEnabled
    public Boolean compiled;
    @AuraEnabled
    public Boolean success;
    @AuraEnabled
    public String compileProblem;
    @AuraEnabled
    public String exceptionMessage;
    @AuraEnabled
    public String exceptionStackTrace;
    @AuraEnabled
    public Integer line;
    @AuraEnabled
    public Integer column;
  }

  /**
   * Wrapper for debug log info
   */
  public class DebugLogInfo {
    @AuraEnabled
    public String id;
    @AuraEnabled
    public String application;
    @AuraEnabled
    public Integer durationMs;
    @AuraEnabled
    public String location;
    @AuraEnabled
    public Integer logLength;
    @AuraEnabled
    public String userName;
    @AuraEnabled
    public String operation;
    @AuraEnabled
    public String request;
    @AuraEnabled
    public String startTime;
    @AuraEnabled
    public String status;
  }
}
