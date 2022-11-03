package vscode;

import com.intuit.karate.StringUtils;
import com.intuit.karate.Suite;
import com.intuit.karate.core.FeatureRuntime;
import com.intuit.karate.core.ScenarioOutline;
import com.intuit.karate.core.ScenarioRuntime;
import org.slf4j.LoggerFactory;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.stream.Collectors;

import static vscode.compatibility.KarateCompatibility.feature;
import static vscode.compatibility.KarateCompatibility.features;

/**
 * @author ivangsa
 */
public class VSCodeOutputRuntimeHook implements ExtendedRuntimeHook {

    private org.slf4j.Logger log = LoggerFactory.getLogger(this.getClass());


    @Override
    public void beforeSuite(Suite suite) {
        try {
            String features = features(suite).stream().map(f -> f.getResource().getRelativePath()).collect(Collectors.joining(";"));
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
                String path = feature(fr).getResource().getRelativePath();
                println(String.format(FEATURE_STARTED, getCurrentTime(), path + ":" + feature(fr).getLine(), escape(feature(fr).getNameForReport())));
                // log.trace(String.format(FEATURE_STARTED, getCurrentTime(), path + ":" + feature(fr).getLine(), escape(feature(fr).getNameForReport())));
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
                String path = feature(fr).getResource().getRelativePath();
                println(String.format(FEATURE_FINISHED, getCurrentTime(), path + ":" + feature(fr).getLine(), (int) fr.result.getDurationMillis(), escape(feature(fr).getNameForReport())));
                // log.trace(String.format(FEATURE_FINISHED, getCurrentTime(), path + ":" + feature(fr).getLine(), (int) fr.result.getDurationMillis(), escape(feature(fr).getNameForReport())));
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
                    println(String.format(SCENARIO_FAILED, getCurrentTime(), path + ":" + sr.scenario.getLine(), (int) sr.result.getDurationMillis(), sr.scenario.isOutlineExample(), sr.scenario.isDynamic(), escape(error.right), escape(error.left), escape(sr.scenario.getRefIdAndName()), ""));
                    // log.trace(String.format(SCENARIO_FAILED, getCurrentTime(), path + ":" + feature(fr).getLine(), (int) sr.result.getDurationMillis(), sr.scenario.isOutlineExample(), sr.scenario.isDynamic(), escape(error.right), escape(error.right), escape(error.left), escape(sr.scenario.getRefIdAndName()), ""));
                } else {
                    println(String.format(SCENARIO_FINISHED, getCurrentTime(), path + ":" + sr.scenario.getLine(), (int) sr.result.getDurationMillis(), sr.scenario.isOutlineExample(), sr.scenario.isDynamic(), escape(sr.scenario.getRefIdAndName())));
                    // log.trace(String.format(SCENARIO_FINISHED, getCurrentTime(), path + ":" + feature(fr).getLine(), (int) sr.result.getDurationMillis(), sr.scenario.isOutlineExample(), sr.scenario.isDynamic(), escape(sr.scenario.getRefIdAndName())));
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
                println(String.format(SCENARIO_OUTLINE_FINISHED, getCurrentTime(), path + ":" + scenarioOutline.getLine(), (int) sr.result.getDurationMillis(), escape(outlineName)));
                // log.trace(String.format(SCENARIO_OUTLINE_FINISHED, getCurrentTime(), path + ":" + scenarioOutline.getLine(), (int) sr.result.getDurationMillis(), escape(outlineName)));
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
    private static final String SCENARIO_FAILED = "##vscode {\"event\": \"testFailed\", \"timestamp\": \"%s\", \"locationHint\": \"%s\", \"duration\": \"%s\", \"outline\":%s, \"dynamic\":%s, \"details\": \"%s\", \"message\": \"%s\", \"name\": \"%s\" %s}";
    private static final String SCENARIO_FINISHED = "##vscode {\"event\": \"testFinished\", \"timestamp\": \"%s\", \"locationHint\": \"%s\", \"duration\": \"%s\", \"outline\":%s, \"dynamic\":%s, \"name\": \"%s\"}";
    private static final String SCENARIO_OUTLINE_FINISHED = "##vscode {\"event\": \"testOutlineFinished\", \"timestamp\": \"%s\", \"locationHint\": \"%s\", \"duration\": \"%s\", \"name\": \"%s\"}";
    private static final String FEATURE_FINISHED = "##vscode {\"event\": \"featureFinished\", \"timestamp\": \"%s\", \"locationHint\": \"%s\", \"duration\": \"%s\", \"name\": \"%s\"}";
    static final String SUITE_FINISHED = "##vscode {\"event\": \"testSuiteFinished\", \"timestamp\": \"%s\", \"duration\": \"%s\"}";
}
