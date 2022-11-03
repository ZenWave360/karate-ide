package vscode.compatibility;

import com.intuit.karate.Suite;
import com.intuit.karate.core.Feature;
import com.intuit.karate.core.FeatureRuntime;
import com.intuit.karate.core.ScenarioCall;

import java.util.List;

public class KarateCompatibility {

    private static Karate compatibility;
    static {
        try {
            Thread.currentThread().getContextClassLoader().loadClass("com.intuit.karate.core.FeatureCall");
            compatibility = new Karate13();
        } catch (ClassNotFoundException e) {
            compatibility = new Karate12();
        }
    }

    public static Feature feature(FeatureRuntime featureRuntime) {
        return compatibility.feature(featureRuntime);
    }

    public static Feature feature(ScenarioCall scenarioCall) {
        return compatibility.feature(scenarioCall);
    }

    public static int getFeatureCallLine(FeatureRuntime featureRuntime) {
        return compatibility.getFeatureCallLine(featureRuntime);
    }

    public static List<Feature> features(Suite suite) {
        return compatibility.features(suite);
    }
}
