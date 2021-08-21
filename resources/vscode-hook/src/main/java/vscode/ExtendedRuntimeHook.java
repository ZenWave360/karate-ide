package vscode;

import com.intuit.karate.RuntimeHook;
import com.intuit.karate.core.ScenarioOutline;
import com.intuit.karate.core.ScenarioRuntime;

public interface ExtendedRuntimeHook extends RuntimeHook {

    default String getOutlineName(ScenarioRuntime sr) {
        return sr.scenario.getSection().isOutline()? String.format("[%s:%s] %s", sr.scenario.getSection().getIndex() + 1, sr.scenario.getSection().getScenarioOutline().getLine(), sr.scenario.getSection().getScenarioOutline().getName()) : null;
    }

    default boolean beforeScenarioOutline(ScenarioOutline scenarioOutline, ScenarioRuntime sr) {
        return true;
    }

    default void afterScenarioOutline(ScenarioOutline scenarioOutline, ScenarioRuntime sr) {
    }
}
