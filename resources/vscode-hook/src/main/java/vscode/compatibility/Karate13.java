package vscode.compatibility;

import com.intuit.karate.Suite;
import com.intuit.karate.core.Feature;
import com.intuit.karate.core.FeatureRuntime;
import com.intuit.karate.core.ScenarioCall;

import java.util.List;
import java.util.stream.Collectors;

class Karate13 implements Karate {
    @Override
    public Feature feature(FeatureRuntime featureRuntime) {
        return featureRuntime.featureCall.feature;
    }

    @Override
    public Feature feature(ScenarioCall scenarioCall) {
        return scenarioCall.featureCall.feature;
    }

    @Override
    public int getFeatureCallLine(FeatureRuntime featureRuntime) {
        return feature(featureRuntime).getLine();
    }

    @Override
    public List<Feature> features(Suite suite) {
        return suite.features.stream().map(featureCall -> featureCall.feature).collect(Collectors.toList());
    }
}
