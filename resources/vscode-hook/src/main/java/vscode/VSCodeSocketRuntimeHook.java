package vscode;

import com.intuit.karate.StringUtils;
import com.intuit.karate.Suite;
import com.intuit.karate.core.Feature;
import com.intuit.karate.core.FeatureRuntime;
import com.intuit.karate.core.ScenarioOutline;
import com.intuit.karate.core.ScenarioRuntime;
import com.intuit.karate.http.HttpRequest;
import com.intuit.karate.http.Response;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.StringWriter;
import java.io.Writer;
import java.lang.reflect.Field;
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
        REQUEST, RESPONSE, SUITE_START, SUITE_END, FEATURE_START, FEATURE_END, SCENARIO_START, SCENARIO_END
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

    private void send(Event event) throws IOException, IllegalAccessException {
        if (port == null || client == null) {
            return;
        }
        log.trace("VSCodeSocketRuntimeHook " + event.eventType + " " + event.feature + " " + event.status + " " + event.callDepth);
        client.write(ByteBuffer.wrap(toJson(event).getBytes(UTF_8)));
    }

    private ThreadLocal<String> threadName = new ThreadLocal<>();

    @Override
    public void beforeSuite(Suite suite) {
        threadName.set(getCurrentTime());
        try {
            Event event = new Event();
            event.eventType = EventType.SUITE_START;
            event.thread = threadName.get();
            event.timestamp = System.currentTimeMillis();
            send(event);
        } catch (Exception e) {
            log.debug("VSCodeHook error", e);
        }
    }

    @Override
    public void afterSuite(Suite suite) {
        try {
            Event event = new Event();
            event.eventType = EventType.SUITE_END;
            event.thread = threadName.get();
            event.timestamp = System.currentTimeMillis();
            send(event);
        } catch (Exception e) {
            log.debug("VSCodeHook error", e);
        }
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

    public static String toJson(Event event) throws IllegalAccessException {
        Map<String, Object> map = new HashMap<>();
        for(Field field: event.getClass().getDeclaredFields()) {
            map.put(field.getName(), field.get(event));
        }
        return toJson(map);
    }

    public static String toJson(Map<String, Object> map) {
        java.io.Writer writer = new StringWriter();
        try {
            boolean needsComma = false;
            writer.write('{');
            for (final Map.Entry<String,?> entry : map.entrySet()) {
                if (needsComma) {
                    writer.write(',');
                }
                final String key = entry.getKey();
                quote(key, writer);
                writer.write(':');
                try {
                    writeValue(writer, entry.getValue());
                } catch (Exception e) {
                    throw new RuntimeException("Unable to write JSONObject value for key: " + key, e);
                }
                needsComma = true;
            }
            writer.write('}');
            return writer.toString();
        } catch (IOException exception) {
            throw new RuntimeException(exception);
        }
    }

    static final Writer writeValue(Writer writer, Object value) throws IOException {
        if (value == null || value.equals(null)) {
            writer.write("null");
        } else if (value instanceof Number) {
                writer.write(value.toString());
        } else if (value instanceof Boolean) {
            writer.write(value.toString());
        } else if (value instanceof Enum<?>) {
            quote(((Enum<?>)value).name(), writer);
        } else if (value instanceof Map) {
            writer.write(toJson((Map) value));
        } else {
            quote(value.toString(), writer);
        }
        return writer;
    }

    public static Writer quote(String string, Writer w) throws IOException {
        if (string == null || string.isEmpty()) {
            w.write("\"\"");
            return w;
        }

        char b;
        char c = 0;
        String hhhh;
        int i;
        int len = string.length();

        w.write('"');
        for (i = 0; i < len; i += 1) {
            b = c;
            c = string.charAt(i);
            switch (c) {
                case '\\':
                case '"':
                    w.write('\\');
                    w.write(c);
                    break;
                case '/':
                    if (b == '<') {
                        w.write('\\');
                    }
                    w.write(c);
                    break;
                case '\b':
                    w.write("\\b");
                    break;
                case '\t':
                    w.write("\\t");
                    break;
                case '\n':
                    w.write("\\n");
                    break;
                case '\f':
                    w.write("\\f");
                    break;
                case '\r':
                    w.write("\\r");
                    break;
                default:
                    if (c < ' ' || (c >= '\u0080' && c < '\u00a0')
                            || (c >= '\u2000' && c < '\u2100')) {
                        w.write("\\u");
                        hhhh = Integer.toHexString(c);
                        w.write("0000", 0, 4 - hhhh.length());
                        w.write(hhhh);
                    } else {
                        w.write(c);
                    }
            }
        }
        w.write('"');
        return w;
    }
}
