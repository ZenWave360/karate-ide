function fn() {
    function read(file) {
        try {
            return karate.read(file);
        } catch (e) {
            // karate.log('File not found: ' + file);
            return {};
        }
    }

    // load config settings from config.yml files with env specific and credentials overrides
    karate.set(read('classpath:karate-config/config.yml'));
    karate.set(read(`classpath:karate-config/config-${karate.env}.yml`));
    karate.set(read('classpath:karate-config/credentials.yml'));
    karate.set(read(`classpath:karate-config/credentials-${karate.env}.yml`));
    karate.set(read(`classpath:karate-config/gitignored-credentials.yml`));
    karate.set(read(`classpath:karate-config/gitignored-credentials-${karate.env}.yml`));

    return {};
}
