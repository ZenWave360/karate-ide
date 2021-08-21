package vscode;

import com.intuit.karate.JsonUtils;
import com.intuit.karate.RuntimeHook;
import com.intuit.karate.StringUtils;
import com.intuit.karate.Suite;
import com.intuit.karate.core.Feature;
import com.intuit.karate.core.FeatureRuntime;
import com.intuit.karate.core.Scenario;
import com.intuit.karate.core.ScenarioOutline;
import com.intuit.karate.core.ScenarioRuntime;
import com.intuit.karate.core.Step;
import com.intuit.karate.core.StepResult;
import com.intuit.karate.http.HttpRequest;
import com.intuit.karate.http.Response;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.StandardSocketOptions;
import java.nio.ByteBuffer;
import java.nio.channels.SocketChannel;
import java.text.SimpleDateFormat;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;
import java.util.stream.Collectors;

import static java.nio.charset.StandardCharsets.UTF_8;

/**
 * @author ivangsa
 */
public class VSCodeSocketRuntimeHook implements ExtendedRuntimeHook {

    private org.slf4j.Logger log = LoggerFactory.getLogger(this.getClass());

    private final String host;
    private final Integer port;
    SocketChannel client;

    enum EventType {
        REQUEST, RESPONSE, FEATURE_START, FEATURE_END, SCENARIO_START, SCENARIO_END
    }

    class Event {
        Long timestamp;
        EventType eventType;
        String thread;

        String currentDir = System.getProperty("user.dir");
        /* root feature name */
        String rootFeature;
        /* root scenario name */
        String rootScenario;

        /* parent hashcode */
        // int parent;
        /* feature name */
        String feature;
        /* scenario name */
        String scenario;
        /* is scenario outline */
        Boolean isOutline;
        Boolean isDinamic;
        /* scenario or feature name */
        String name;
        /* resource filename */
        String resource;
        int line;
        /* caller feature name */
        String caller;
        int callDepth;

        /* http logs info */
        String url;
        String method;
        String status;
        String failureMessage;
        Map<String, String> headers;
        String payload;

        public String getCurrentDir() {
            return currentDir;
        }

        public void setCurrentDir(String currentDir) {
            this.currentDir = currentDir;
        }

        public int getCallDepth() {
            return callDepth;
        }

        public void setCallDepth(int callDepth) {
            this.callDepth = callDepth;
        }

        public String getCaller() {
            return caller;
        }

        public void setCaller(String caller) {
            this.caller = caller;
        }

        public String getUrl() {
            return url;
        }

        public void setUrl(String url) {
            this.url = url;
        }

        public String getMethod() {
            return method;
        }

        public void setMethod(String method) {
            this.method = method;
        }

        public Long getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(Long timestamp) {
            this.timestamp = timestamp;
        }

        public EventType getEventType() {
            return eventType;
        }

        public void setEventType(EventType eventType) {
            this.eventType = eventType;
        }

        public String getThread() {
            return thread;
        }

        public void setThread(String thread) {
            this.thread = thread;
        }

        public String getRootFeature() {
            return rootFeature;
        }

        public void setRootFeature(String rootFeature) {
            this.rootFeature = rootFeature;
        }

        public String getRootScenario() {
            return rootScenario;
        }

        public void setRootScenario(String rootScenario) {
            this.rootScenario = rootScenario;
        }

        public String getFeature() {
            return feature;
        }

        public void setFeature(String feature) {
            this.feature = feature;
        }

        public String getScenario() {
            return scenario;
        }

        public void setScenario(String scenario) {
            this.scenario = scenario;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getResource() {
            return resource;
        }

        public void setResource(String resource) {
            this.resource = resource;
        }

        public Boolean getIsOutline() {
            return isOutline;
        }

        public void setIsOutline(Boolean outline) {
            isOutline = outline;
        }

        public Boolean getIsDinamic() {
            return isDinamic;
        }

        public void setIsDinamic(Boolean dinamic) {
            isDinamic = dinamic;
        }

        public int getLine() {
            return line;
        }

        public void setLine(int line) {
            this.line = line;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public String getFailureMessage() {
            return failureMessage;
        }

        public void setFailureMessage(String failureMessage) {
            this.failureMessage = failureMessage;
        }

        public Map<String, String> getHeaders() {
            return headers;
        }

        public void setHeaders(Map<String, String> headers) {
            this.headers = headers;
        }

        public String getPayload() {
            return payload;
        }

        public void setPayload(String payload) {
            this.payload = payload;
        }
    }

    public VSCodeSocketRuntimeHook() {
        host = System.getProperty("vscode.host");
        String portString = System.getProperty("vscode.port");
        port = portString.matches("\\d+") ? Integer.parseInt(portString) : null;
        log.trace("VSCodeHook {}:{}", host, port);
        if (port != null) {
            try {
                connect();
            } catch (Exception e) {
                log.debug("VSCodeHook error", e);
            }
        }
    }

    private void connect() throws IOException, ExecutionException, InterruptedException, TimeoutException {
        client = SocketChannel.open();
        client.setOption(StandardSocketOptions.SO_KEEPALIVE, true);
        boolean connected = client.connect(new InetSocketAddress(host != null ? host : "localhost", port));
        log.debug("SocketChannel connection: {}", connected);
    }

    private void send(Event event) throws IOException, ExecutionException, InterruptedException, TimeoutException {
        if (port == null || client == null) {
            return;
        }
        log.trace(event.thread + " " + event.eventType + " " + event.feature + " " + event.status + " " + event.callDepth);
        int out = client.write(ByteBuffer.wrap(JsonUtils.toJson(event).getBytes(UTF_8)));
        log.trace("out = " + out);
    }

    private ThreadLocal<String> threadName = new ThreadLocal<>();

    @Override
    public void beforeSuite(Suite suite) {
        threadName.set(getCurrentTime());
    }

    private boolean isSame(Feature f1, Feature f2) {
        if (f1 == f2) {
            return true;
        }
        if (f1 == null || f2 == null) {
            return false;
        }
        return f1.getResource().getPrefixedPath().equals(f2.getResource().getPrefixedPath());
    }

    private String getFeatureName(Feature feature) {
        return String.format("%s:%s %s", feature.getResource().getRelativePath(), feature.getLine(), feature.getNameForReport());
    }

    @Override
    public boolean beforeFeature(FeatureRuntime fr) {
        try {
            if (fr.caller.parentRuntime != null && isSame(fr.feature, fr.caller.parentRuntime.scenario.getFeature())) {
                // System.out.println("fr.feature " + fr.feature.getNameForReport());
                return true;
            }
            Event event = new Event();
            event.eventType = EventType.FEATURE_START;
            event.thread = threadName.get();
            event.timestamp = System.currentTimeMillis();
            event.name = getFeatureName(fr.feature);
            event.feature = fr.feature.getNameForReport();
            event.rootFeature = fr.rootFeature.feature.getNameForReport();
            event.resource = fr.feature.getResource().getRelativePath();
            event.line = fr.feature.getCallLine();
            if (fr.caller != null && fr.caller.feature != null) {
                // event.parent = fr.caller.hashCode();
                event.caller = fr.caller.feature.getNameForReport();
                event.callDepth = fr.caller.depth;
            }

            send(event);
        } catch (Exception e) {
            log.debug("VSCodeHook error", e);
        }
        return true;
    }

    @Override
    public void afterFeature(FeatureRuntime fr) {
        if (fr.caller.parentRuntime != null && isSame(fr.feature, fr.caller.parentRuntime.scenario.getFeature())) {
            // log.debug("afterFeature", fr.feature, fr.caller.parentRuntime.scenario.getFeature(), fr.caller.parentRuntime != null, isSame(fr.feature, fr.caller.parentRuntime.scenario.getFeature()));
            return;
        }
        try {
            Event event = new Event();
            event.eventType = EventType.FEATURE_END;
            event.thread = threadName.get();
            event.timestamp = System.currentTimeMillis();
            event.name = getFeatureName(fr.feature);
            event.feature = fr.feature.getNameForReport();
            event.rootFeature = fr.rootFeature.feature.getNameForReport();
            event.resource = fr.feature.getResource().getRelativePath();
            event.line = fr.feature.getCallLine();
            if (fr.caller != null && fr.caller.feature != null) {
                event.caller = fr.caller.feature.getNameForReport(); // TODO build resource line
                event.callDepth = fr.caller.depth;
            }
            event.status = fr.result.isFailed() ? "KO" : "OK";
            event.failureMessage = fr.result.getErrorMessages();

            send(event);
        } catch (Exception e) {
            log.debug("VSCodeHook error", e);
        }

    }

    @Override
    public boolean beforeScenario(ScenarioRuntime sr) {
        try {
            Event event = new Event();
            event.eventType = EventType.SCENARIO_START;
            event.thread = threadName.get();
            event.timestamp = System.currentTimeMillis();
            event.name = sr.scenario.getRefIdAndName();
            event.feature = sr.featureRuntime.feature.getNameForReport();
            event.rootFeature = sr.featureRuntime.rootFeature.feature.getNameForReport();
            event.scenario = sr.scenario.getRefIdAndName();
            event.resource = sr.featureRuntime.feature.getResource().getRelativePath();
            event.line = sr.scenario.getLine();
            if (sr.scenario.isOutlineExample()) {
                event.isOutline = true;
                event.isDinamic = sr.scenario.isDynamic();
            }
            if (sr.caller != null && sr.caller.feature != null) {
                // event.parent = sr.caller.hashCode();
                event.caller = sr.caller.feature.getNameForReport();
                event.callDepth = sr.caller.depth;
                try {
                    // event.payload = sr.caller.arg.getAsString();
                } catch (Exception e) {
                    event.payload = e.getMessage();
                }
            }

            send(event);
        } catch (Exception e) {
            log.debug("VSCodeHook error", e);
        }
        return true;
    }

    @Override
    public void afterScenario(ScenarioRuntime sr) {
        try {
            Event event = new Event();
            event.eventType = EventType.SCENARIO_END;
            event.thread = threadName.get();
            event.timestamp = System.currentTimeMillis();
            event.name = sr.scenario.getRefIdAndName();
            event.feature = sr.featureRuntime.feature.getNameForReport();
            event.rootFeature = sr.featureRuntime.rootFeature.feature.getNameForReport();
            event.scenario = sr.scenario.getRefIdAndName();
            event.resource = sr.featureRuntime.feature.getResource().getRelativePath();
            event.line = sr.scenario.getLine();
            if (sr.scenario.isOutlineExample()) {
                event.isOutline = true;
                event.isDinamic = sr.scenario.isDynamic();
            }
            if (sr.caller != null && sr.caller.feature != null) {
                event.caller = sr.caller.feature.getNameForReport();
                event.callDepth = sr.caller.depth;
            }
            event.status = sr.result.isFailed() ? "KO" : "OK";
            event.failureMessage = sr.result.getErrorMessage();
            try {
                // event.payload = JsonUtils.toJson(sr.result.toKarateJson());
            } catch (Exception e) {
                event.payload = e.getMessage();
            }

            send(event);
        } catch (Exception e) {
            log.debug("VSCodeHook error", e);
        }
    }

    @Override
    public boolean beforeScenarioOutline(ScenarioOutline scenarioOutline, ScenarioRuntime sr) {
        try {
            Event event = new Event();
            event.eventType = EventType.SCENARIO_START;
            event.thread = threadName.get();
            event.timestamp = System.currentTimeMillis();
            event.name =  getOutlineName(sr);
            event.feature = sr.featureRuntime.feature.getNameForReport();
            event.rootFeature = sr.featureRuntime.rootFeature.feature.getNameForReport();
            event.scenario = getOutlineName(sr);
            event.resource = sr.featureRuntime.feature.getResource().getRelativePath();
            event.line = sr.scenario.getLine();
            if (sr.scenario.isOutlineExample()) {
                event.isOutline = true;
                event.isDinamic = sr.scenario.isDynamic();
            }
            if (sr.caller != null && sr.caller.feature != null) {
                // event.parent = sr.caller.hashCode();
                event.caller = sr.caller.feature.getNameForReport();
                event.callDepth = sr.caller.depth;
                try {
                    // event.payload = sr.caller.arg.getAsString();
                } catch (Exception e) {
                    event.payload = e.getMessage();
                }
            }

            send(event);
        } catch (Exception e) {
            log.debug("VSCodeHook error", e);
        }
        return true;
    }

    @Override
    public void afterScenarioOutline(ScenarioOutline scenarioOutline, ScenarioRuntime sr) {
        try {
            Event event = new Event();
            event.eventType = EventType.SCENARIO_END;
            event.thread = threadName.get();
            event.timestamp = System.currentTimeMillis();
            event.name =  getOutlineName(sr);
            event.feature = sr.featureRuntime.feature.getNameForReport();
            event.rootFeature = sr.featureRuntime.rootFeature.feature.getNameForReport();
            event.scenario = getOutlineName(sr);
            event.resource = sr.featureRuntime.feature.getResource().getRelativePath();
            event.line = sr.scenario.getLine();
            if (sr.scenario.isOutlineExample()) {
                event.isOutline = true;
                event.isDinamic = sr.scenario.isDynamic();
            }
            if (sr.caller != null && sr.caller.feature != null) {
                event.caller = sr.caller.feature.getNameForReport();
                event.callDepth = sr.caller.depth;
            }
            event.status = sr.result.isFailed() ? "KO" : "OK";
            event.failureMessage = sr.result.getErrorMessage();
            try {
                // event.payload = JsonUtils.toJson(sr.result.toKarateJson());
            } catch (Exception e) {
                event.payload = e.getMessage();
            }

            send(event);
        } catch (Exception e) {
            log.debug("VSCodeHook error", e);
        }
    }

    public void beforeHttpCall(HttpRequest request, ScenarioRuntime sr) {
        try {
            Event event = new Event();
            event.thread = threadName.get();
            event.eventType = EventType.REQUEST;
            event.method = request.getMethod();
            event.url = request.getUrl();
            event.headers = new HashMap<>(fromHeaders(request.getHeaders()));
            event.payload = request.getBodyAsString();
            send(event);
        } catch (Exception e) {
            log.debug("VSCodeHook error", e);
        }
    }

    public void afterHttpCall(HttpRequest request, Response response, ScenarioRuntime sr) {
        try {
            Event event = new Event();
            event.thread = threadName.get();
            event.eventType = EventType.RESPONSE;
            event.method = request.getMethod();
            event.url = request.getUrl();
            event.status = String.valueOf(response.getStatus());
            event.headers = new HashMap<>(fromHeaders(response.getHeaders()));
            event.payload = response.getBodyAsString();
            send(event);
        } catch (Exception e) {
            log.debug("VSCodeHook error", e);
        }
    }

    private Map<String, String> fromHeaders(Map<String, List<String>> headers) {
        if (headers == null) {
            return Collections.emptyMap();
        }
        return headers.entrySet().stream()
                .collect(Collectors.toMap(e -> e.getKey(), e -> StringUtils.join(e.getValue().toArray(), ',')));
    }

    private static String getCurrentTime() {
        return DATE_FORMAT.format(new Date());
    }

    private static StringUtils.Pair details(String errorMessage) {
        String fullMessage = errorMessage.replace("\r", "").replace("\t", "  ");
        String[] messageInfo = fullMessage.split("\n", 2);
        if (messageInfo.length == 2) {
            return StringUtils.pair(messageInfo[0].trim(), messageInfo[1].trim());
        } else {
            return StringUtils.pair(fullMessage, "");
        }
    }

    private static final SimpleDateFormat DATE_FORMAT = new SimpleDateFormat("yyyy-MM-dd'T'hh:mm:ss.SSSZ");

}
