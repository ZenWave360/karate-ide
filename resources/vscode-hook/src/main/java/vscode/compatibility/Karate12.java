package vscode.compatibility;

import com.intuit.karate.Suite;
import com.intuit.karate.core.Feature;
import com.intuit.karate.core.FeatureRuntime;
import com.intuit.karate.core.ScenarioCall;

import java.lang.reflect.InvocationTargetException;
import java.util.List;

class Karate12 implements Karate {
    @Override
    public Feature feature(FeatureRuntime featureRuntime) {
        try {
            // compatibility with karate 1.2.0 and previous
            return (Feature) featureRuntime.getClass().getField("feature").get(featureRuntime);
        } catch (IllegalAccessException ex) {
            throw new RuntimeException(ex);
        } catch (NoSuchFieldException ex) {
            throw new RuntimeException(ex);
        }
    }

    @Override
    public Feature feature(ScenarioCall scenarioCall) {
        try {
            // compatibility with karate 1.2.0 and previous
            return (Feature) scenarioCall.getClass().getField("feature").get(scenarioCall);
        } catch (IllegalAccessException ex) {
            throw new RuntimeException(ex);
        } catch (NoSuchFieldException ex) {
            throw new RuntimeException(ex);
        }
    }

    @Override
    public int getFeatureCallLine(FeatureRuntime featureRuntime) {
        Feature feature = feature(featureRuntime);
        try {
            return (int) feature.getClass().getMethod("getCallLine").invoke(feature);
        } catch (IllegalAccessException ex) {
            throw new RuntimeException(ex);
        } catch (InvocationTargetException ex) {
            throw new RuntimeException(ex);
        } catch (NoSuchMethodException ex) {
            throw new RuntimeException(ex);
        }
    }

    @Override
    public List<Feature> features(Suite suite) {
        try {
            return (List<Feature>) suite.getClass().getField("features").get(suite);
        } catch (IllegalAccessException ex) {
            throw new RuntimeException(ex);
        } catch (NoSuchFieldException ex) {
            throw new RuntimeException(ex);
        }
    }
}
