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
public class VSCodeOutputRuntimeHook implements ExtendedRuntimeHook {

    private org.slf4j.Logger log = LoggerFactory.getLogger(this.getClass());


    @Override
    public void beforeSuite(Suite suite) {
        try {
            String features = suite.features.stream().map(f -> f.getResource().getRelativePath()).collect(Collectors.joining(";"));
            println(String.format(SUITE_STARTED, getCurrentTime(), features, suite.featuresFound));
            // log.trace(String.format(SUITE_STARTED, getCurrentTime(), features, suite.featuresFound));
        } catch (Exception e) {
            log.error("beforeSuite error: {}", e.getMessage());
        }
    }

    @Override
    public void afterSuite(Suite suite) {
        try {
            println(String.format(SUITE_FINISHED, getCurrentTime(), suite.buildResults().getEndTime() - suite.startTime));
            // log.trace(String.format(SUITE_FINISHED, getCurrentTime(), suite.buildResults().getEndTime() - suite.startTime));
        } catch (Exception e) {
            log.error("afterSuite error: {}", e.getMessage());
        }
    }


    @Override
    public boolean beforeFeature(FeatureRuntime fr) {
        try {
            if (fr.caller.depth == 0) {
                String path = fr.feature.getResource().getRelativePath();
                println(String.format(FEATURE_STARTED, getCurrentTime(), path + ":" + fr.feature.getLine(), escape(fr.feature.getNameForReport())));
                // log.trace(String.format(FEATURE_STARTED, getCurrentTime(), path + ":" + fr.feature.getLine(), escape(fr.feature.getNameForReport())));
            }
        } catch (Exception e) {
            log.error("beforeFeature error: {}", e.getMessage());
        }
        return true;
    }

    @Override
    public void afterFeature(FeatureRuntime fr) {
        try {
            if (fr.caller.depth == 0) {
                String path = fr.feature.getResource().getRelativePath();
                println(String.format(FEATURE_FINISHED, getCurrentTime(), (int) fr.result.getDurationMillis(), escape(fr.feature.getNameForReport())));
                // log.trace(String.format(FEATURE_FINISHED, getCurrentTime(), (int) fr.result.getDurationMillis(), escape(fr.feature.getNameForReport())));
            }
        } catch (Exception e) {
            log.error("afterFeature error: {}", e.getMessage());
        }
    }

    @Override
    public boolean beforeScenario(ScenarioRuntime sr) {
        try {
            if (sr.caller.depth == 0) {
                String path = sr.scenario.getFeature().getResource().getRelativePath();
                println(String.format(SCENARIO_STARTED, getCurrentTime(), path + ":" + sr.scenario.getLine(), escape(sr.scenario.getRefIdAndName()), sr.scenario.isOutlineExample(), sr.scenario.isDynamic()));
                // log.trace(String.format(SCENARIO_STARTED, getCurrentTime(), path + ":" + sr.scenario.getLine(), escape(sr.scenario.getRefIdAndName()), sr.scenario.isOutlineExample(), sr.scenario.isDynamic()));
            }
        } catch (Exception e) {
            log.error("beforeScenario error: {}", e.getMessage());
        }
        return true;
    }

    @Override
    public void afterScenario(ScenarioRuntime sr) {
        try {
            // System.out.println(String.format("#vscode afterScenario %s %s", sr.caller.depth, sr.scenario.getRefIdAndName()));
            if (sr.caller.depth == 0) {
                String path = sr.scenario.getFeature().getResource().getRelativePath();
                if (sr.result.isFailed()) {
                    StringUtils.Pair error = details(sr.result.getErrorMessage());
                    println(String.format(SCENARIO_FAILED, getCurrentTime(), (int) sr.result.getDurationMillis(), escape(error.right), escape(error.left), escape(sr.scenario.getRefIdAndName()), ""));
                    // log.trace(String.format(SCENARIO_FAILED, getCurrentTime(), (int) sr.result.getDurationMillis(), escape(error.right), escape(error.left), escape(sr.scenario.getRefIdAndName()), ""));
                } else {
                    println(String.format(SCENARIO_FINISHED, getCurrentTime(), (int) sr.result.getDurationMillis(), escape(sr.scenario.getRefIdAndName())));
                    // log.trace(String.format(SCENARIO_FINISHED, getCurrentTime(), (int) sr.result.getDurationMillis(), escape(sr.scenario.getRefIdAndName())));
                }
            }
        } catch (Exception e) {
            log.error("afterScenario error: {}", e.getMessage());
        }
    }

    @Override
    public boolean beforeScenarioOutline(ScenarioOutline scenarioOutline, ScenarioRuntime sr) {
        try {
            if (sr.caller.depth == 0) {
                String path = sr.scenario.getFeature().getResource().getRelativePath();
                String outlineName = getOutlineName(sr);
                println(String.format(SCENARIO_OUTLINE_STARTED, getCurrentTime(), path + ":" + sr.scenario.getSection().getScenarioOutline().getLine(), escape(outlineName), sr.scenario.isOutlineExample(), sr.scenario.isDynamic()));
                // log.trace(String.format(SCENARIO_OUTLINE_STARTED, getCurrentTime(), path + ":" + sr.scenario.getSection().getScenarioOutline().getLine(), escape(outlineName), sr.scenario.isOutlineExample(), sr.scenario.isDynamic()));
            }
        } catch (Exception e) {
            log.error("beforeScenarioOutline error: {}", e.getMessage());
        }
        return true;
    }

    @Override
    public void afterScenarioOutline(ScenarioOutline scenarioOutline, ScenarioRuntime sr) {
        try {
            if (sr.caller.depth == 0) {
                String path = sr.scenario.getFeature().getResource().getRelativePath();
                String outlineName = getOutlineName(sr);
                println(String.format(SCENARIO_OUTLINE_FINISHED, getCurrentTime(), (int) sr.result.getDurationMillis(), escape(outlineName)));
                // log.trace(String.format(SCENARIO_OUTLINE_FINISHED, getCurrentTime(), (int) sr.result.getDurationMillis(), escape(outlineName)));
            }
        } catch (Exception e) {
            log.error("afterScenarioOutline error: {}", e.getMessage());
        }
    }


    static void println(String s) {
        System.out.println(s);
    }

    private static String getCurrentTime() {
        return DATE_FORMAT.format(new Date());
    }

    private static String escape(String source) {
        if (source == null) {
            return "";
        }
        return source.replace("\n", "\\n").replace("\r", "\\r").replace("'", "\'").replace("\"", "\\\"");
    }

    private static String truncate(String text, int length) {
        return StringUtils.truncate(text, 1000, true);
    }

    private static StringUtils.Pair details(String errorMessage) {
        String fullMessage = errorMessage.replace("\r", "").replace("\t", "  ");
        String[] messageInfo = fullMessage.split("\n", 2);
        if (messageInfo.length >= 2) {
            return StringUtils.pair(truncate(messageInfo[0].trim(), 100), truncate(messageInfo[1].trim(), 1000));
        } else {
            return StringUtils.pair(fullMessage, "");
        }
    }

    private static final SimpleDateFormat DATE_FORMAT = new SimpleDateFormat("yyyy-MM-dd'T'hh:mm:ss.SSSZ");

    private static final String SUITE_STARTED = "##vscode {\"event\": \"testSuiteStarted\", \"timestamp\": \"%s\", \"features\": \"%s\", \"featuresFound\": \"%s\"}";
    private static final String FEATURE_STARTED = "##vscode {\"event\": \"featureStarted\", \"timestamp\": \"%s\", \"locationHint\": \"%s\", \"name\": \"%s\"}";
    private static final String SCENARIO_OUTLINE_STARTED = "##vscode {\"event\": \"testOutlineStarted\", \"timestamp\": \"%s\", \"locationHint\": \"%s\", \"name\": \"%s\", \"outline\":%s, \"dynamic\":%s }";
    private static final String SCENARIO_STARTED = "##vscode {\"event\": \"testStarted\", \"timestamp\": \"%s\", \"locationHint\": \"%s\", \"name\": \"%s\", \"outline\":%s, \"dynamic\":%s }";
    private static final String SCENARIO_FAILED = "##vscode {\"event\": \"testFailed\", \"timestamp\": \"%s\", \"duration\": \"%s\", \"details\": \"%s\", \"message\": \"%s\", \"name\": \"%s\" %s}";
    private static final String SCENARIO_FINISHED = "##vscode {\"event\": \"testFinished\", \"timestamp\": \"%s\", \"duration\": \"%s\", \"name\": \"%s\"}";
    private static final String SCENARIO_OUTLINE_FINISHED = "##vscode {\"event\": \"testOutlineFinished\", \"timestamp\": \"%s\", \"duration\": \"%s\", \"name\": \"%s\"}";
    private static final String FEATURE_FINISHED = "##vscode {\"event\": \"featureFinished\", \"timestamp\": \"%s\", \"duration\": \"%s\", \"name\": \"%s\"}";
    static final String SUITE_FINISHED = "##vscode {\"event\": \"testSuiteFinished\", \"timestamp\": \"%s\", \"duration\": \"%s\"}";
}
