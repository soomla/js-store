require.config({

    // Allow the base URL to be overriden for development environment purposes
    baseUrl : (typeof requirejsOverrideBaseUrl !== "undefined") ? requirejsOverrideBaseUrl : "",

    // Cancel timeout for really slow devices
    waitSeconds : 0,

    paths: {

        // Models
        economyModels           : "models/economy-models",
        storeModel              : "models/store-model",
        baseModels              : "models/base-models",
        models                  : "models/models",
        hooks                   : "models/hooks",
        modelManipulation       : "models/model-manipulation",

        // Utilities
        utils                   : "utils/utils",
        stringUtils             : "utils/string-utils",
        urls                    : "utils/urls",
        constants               : "utils/constants",
        errors                  : "utils/errors",

        // Backbone related
        underscore          	: "libs/underscore-1.6.0",
        backboneFramework       : "libs/backbone/backbone-1.1.0",
        backboneRelational  	: "libs/backbone/backbone-relational-0.8.6",

        // Aggregative modules
        backbone            	: "libs/backbone/backbone"
    },


    // TODO: Evaluate if this shim can be removed, since Backbone 1.1.2 and Underscore 1.6.0 are AMD-defined
    shim: {
        "backboneFramework" : {
            deps: ['underscore'],
            exports: "Backbone"
        },
        backbone : {
            deps: ['backboneFramework']
        }
    }
});
