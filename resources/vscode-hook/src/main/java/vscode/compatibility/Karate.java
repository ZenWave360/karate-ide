package vscode.compatibility;

import com.intuit.karate.Suite;
import com.intuit.karate.core.Feature;
import com.intuit.karate.core.FeatureRuntime;
import com.intuit.karate.core.ScenarioCall;

import java.util.List;

interface Karate {
    Feature feature(FeatureRuntime featureRuntime);

    Feature feature(ScenarioCall scenarioCall);

    int getFeatureCallLine(FeatureRuntime featureRuntime);

    List<Feature> features(Suite suite);
}
