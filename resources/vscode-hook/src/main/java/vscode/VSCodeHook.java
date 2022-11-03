package vscode;

import com.intuit.karate.RuntimeHook;
import com.intuit.karate.Suite;
import com.intuit.karate.core.FeatureRuntime;
import com.intuit.karate.core.ScenarioOutline;
import com.intuit.karate.core.ScenarioRuntime;
import com.intuit.karate.core.Step;
import com.intuit.karate.core.StepResult;
import com.intuit.karate.http.HttpRequest;
import com.intuit.karate.http.Response;
import org.slf4j.LoggerFactory;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static vscode.compatibility.KarateCompatibility.feature;

/**
 * @author ivangsa
 */
public class VSCodeHook implements RuntimeHook {

    private org.slf4j.Logger log = LoggerFactory.getLogger(this.getClass());

    private List<ExtendedRuntimeHook> runtimeHooks;

    public VSCodeHook() {
        this(new VSCodeOutputRuntimeHook(), new VSCodeSocketRuntimeHook());
    }

    public VSCodeHook(ExtendedRuntimeHook... runtimeHooks) {
        this.runtimeHooks = runtimeHooks != null? Arrays.asList(runtimeHooks) : Collections.emptyList();
    }

    // used to track feature end when no scenarios where selected
    private ThreadLocal<String> currentFeature = new ThreadLocal<>();
    // used to track scenario outline start/stop
    private ThreadLocal<ScenarioOutline> currentOutline = new ThreadLocal<>();
    private ThreadLocal<ScenarioRuntime> currentScenarioRuntime = new ThreadLocal<>();

    @Override
    public void beforeSuite(Suite suite) {
        runtimeHooks.stream().forEach(h -> h.beforeSuite(suite));
    }

    @Override
    public void afterSuite(Suite suite) {
        runtimeHooks.stream().forEach(h -> h.afterSuite(suite));
    }

    @Override
    public boolean beforeFeature(FeatureRuntime fr) {
        if(currentFeature.get() != null) {
            // fixes afterFeature not being called for empty features (no scenarios selected by tags)
            afterFeature(fr);
        }
        this.currentFeature.set(feature(fr).getNameForReport());
        return runtimeHooks.stream().reduce(true, (accumulated, hook) -> hook.beforeFeature(fr), (accumulated, current) -> accumulated && current);
    }

    @Override
    public void afterFeature(FeatureRuntime fr) {
        if (fr.caller.depth == 0 && currentOutline.get() != null) {
            runtimeHooks.stream().forEach(h -> h.afterScenarioOutline(currentOutline.get(), currentScenarioRuntime.get()));
            currentOutline.set(null);
            currentScenarioRuntime.set(null);
        }
        runtimeHooks.stream().forEach(h -> h.afterFeature(fr));
        currentFeature.set(null);
    }

    @Override
    public boolean beforeScenario(ScenarioRuntime sr) {
        sr.evaluateScenarioName();

        if (sr.caller.depth == 0) {
            ScenarioOutline scenarioOutline = sr.scenario.getSection().isOutline() ? sr.scenario.getSection().getScenarioOutline() : null;
            if (currentOutline.get() != null && !currentOutline.get().equals(scenarioOutline)) { // changing from an outline
                runtimeHooks.stream().forEach(h -> h.afterScenarioOutline(currentOutline.get(), sr));
                currentOutline.set(null);
            }
            if (scenarioOutline != null && !scenarioOutline.equals(currentOutline.get())) { // entering an outline
                currentOutline.set(scenarioOutline);
                runtimeHooks.stream().forEach(h -> h.beforeScenarioOutline(sr.scenario.getSection().getScenarioOutline(), sr));
            }
            currentScenarioRuntime.set(sr);
        }

        return runtimeHooks.stream().reduce(true, (accumulated, hook) -> hook.beforeScenario(sr), (accumulated, current) -> accumulated && current);
    }

    @Override
    public void afterScenario(ScenarioRuntime sr) {
        runtimeHooks.stream().forEach(h -> h.afterScenario(sr));
    }

    @Override
    public boolean beforeStep(Step step, ScenarioRuntime sr) {
        return runtimeHooks.stream().reduce(true, (accumulated, hook) -> hook.beforeStep(step, sr), (accumulated, current) -> accumulated && current);
    }

    @Override
    public void afterStep(StepResult result, ScenarioRuntime sr) {
        runtimeHooks.stream().forEach(h -> h.afterStep(result, sr));
    }

    public void beforeHttpCall(HttpRequest request, ScenarioRuntime sr) {
        runtimeHooks.stream().forEach(h -> h.beforeHttpCall(request, sr));
    }

    public void afterHttpCall(HttpRequest request, Response response, ScenarioRuntime sr) {
        runtimeHooks.stream().forEach(h -> h.afterHttpCall(request, response, sr));
    }

//    @Override
//    public void beforeBackground(ScenarioRuntime sr) {
//        runtimeHooks.stream().forEach(h -> h.beforeBackground(sr));
//    }
//
//    @Override
//    public void afterBackground(ScenarioRuntime sr) {
//        runtimeHooks.stream().forEach(h -> h.afterBackground(sr));
//    }
}
