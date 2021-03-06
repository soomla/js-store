define("hooks", ["underscore", "backbone", "baseModels", "stringUtils", "constants"], function(_, Backbone, BaseModels, StringUtils, Constants) {

    //
    // Constants
    //
    var SPONSORPAY = Constants.SPONSORPAY;




    //
    // Backbone Models
    //
    var Action = Backbone.RelationalModel.extend({
        getProvider : function() {
            return this.getRelation("provider").related;
        },
        getAction : function() {
            return this.get("action");
        },
        setName : function(name) {
            return this.set("name", name);
        },
        setDescription: function(description) {
            return this.set("description", description);
        }
    });

    var SponsorpayAction = Action.extend({
        getItemId : function() {
            return this.get("itemId");
        },
        setExchangeRate : function(exchangeRate) {
            return this.set("exchangeRate", exchangeRate);
        }
    });

    //
    // Each hook should implement:
    // 1. A default title for messages
    // 2. A default message function for showing the user when the offer is completed
    //
    _.extend(SponsorpayAction, {
        defaultTitle : function() {
            return "Congratulations!";
        },
        defaultMessage : function(amount, itemName) {
            return "You've just earned " + StringUtils.numberFormat(amount) + " " + itemName + " from SponsorPay";
        }
    });

    var ActionCollection = BaseModels.BaseCollection.extend({
        model : function(attrs, options) {
            return new Action(attrs, options);
        }
    });


    var Provider = Backbone.RelationalModel.extend({
        relations: [
            {
                type: Backbone.HasMany,
                key: "actions",
                relatedModel: Action,
                collectionType: ActionCollection,
                reverseRelation: {
                    key : "provider",
                    includeInJSON: false
                }
            }
        ],
        getActions : function() {
            return this.get("actions");
        }
    });

    var SponsorpayProvider = Provider.extend({
        relations: [
            {
                type: Backbone.HasMany,
                key: "actions",
                relatedModel: SponsorpayAction,
                collectionType: ActionCollection,
                reverseRelation: {
                    key : "provider",
                    includeInJSON: false
                }
            }
        ]
    });

    var ProviderCollection = BaseModels.BaseCollection.extend({
        model : function(attrs, options) {
            if (attrs.id === SPONSORPAY) return new SponsorpayProvider(attrs, options);
            return new Provider(attrs, options);
        }
    });



    var HookManager = function(options) {
        this.theme              = options.theme;
        this.hooks              = options.hooks || {}; // The passed hooks might be undefined
        this.hooksMap           = {};

        //
        // This is an important attribute: it's an array
        // that contains all the providers that the SDK has initialized when the store is initialized
        // This is different from supported features: a provider \ hook can be supported but not yet
        // initialized in the native code.  That's why the dashboard marks hooks as {active: true \ false}
        //
        this.hooksProviders     = options.hooksProviders;

        this.providers = new ProviderCollection();
        _.each(this.hooks.providers, this.providers.add, this.providers);

        // Create a collection for UI purposes that mirrors parts of other collections,
        // i.e. only models that represent offers
        this.offerHooks = new ActionCollection();

        // Populate that collection from all providers with offers
        this.providers.each(function(provider) {

            // Add the provider only if it's initialized in the native code
            // or if we're in hosted mode (STUB_API).
            // Double check existence of SoomlaNative, because iOS doesn't define it on the window
            var stubbedAPI = window.SoomlaNative && window.SoomlaNative.STUB_API;
            var hasHookProvider = _.isArray(this.hooksProviders) ?
                                    _.contains(this.hooksProviders, provider.id) : // Backward compatibility with store versions 3.0.0 - 3.0.3 including
                                    _.isObject(this.hooksProviders) ?              // New method for checking hooks providers - store version v3.1.0
                                    this.hooksProviders[provider.id] :
                                    null;

            if (hasHookProvider || stubbedAPI) {

                if (provider.id === SPONSORPAY) {
                    provider.getActions().each(function(action) {
                        this.offerHooks.add(action);
                        this.hooksMap[action.id] = action;
                    }, this);
                }
            }
        }, this);
    };

    _.extend(HookManager.prototype, {
        removeHook : function(hook) {

            this.offerHooks.remove(hook);
            hook.trigger('destroy', hook, hook.collection, {});
            // TODO: Maybe check if the provider is empty and remove it from the list of providers
        },
        getOfferHooks : function() {
            return this.offerHooks;
        },
        getHook : function(provider, options) {

            // Ensure options object
            (options) || (options = {});

            if (provider === SPONSORPAY) {

                var providerActions = this.providers.get(provider);
                return !providerActions ? undefined :
                        options.itemId ? providerActions.get(options.itemId) :
                        providerActions.first();
            }
            return undefined;
        },
        getProviders : function() {
            return this.providers;
        },
        getProvider : function(id) {
            return this.providers.get(id);
        },
        toJSON : function() {
            var json = {};

            json.providers = [];
            this.providers.each(function(provider) {
                json.providers.push(provider.toJSON());
            });

            return json;
        },
        _unregister : function(entity) {
            Backbone.Relational.store.unregister(entity);
        },
        close : function() {

            //
            // Remove collection items in reverse order.  This prevents a situation
            // where the collection is mutated while iterating and items are skipped
            //

            var providers = this.getProviders();
            for (var i = providers.length - 1; i >= 0; i--) {
                var actions = providers.at(i).getActions();
                for (var j = actions.length - 1; j >= 0; j--) {
                    this._unregister(actions.at(j));
                }
                this._unregister(providers.at(i));
            }
        }
    });


    //
    // A mixin of methods that will be exposed on the store model
    // Assumes the existence of `this.hooks`, `this.template`
    // `this.assets` was removed by event decoupling
    //
    var HooksMixin = {
        addHook : function(providerId, options) {

            if (providerId === SPONSORPAY) {

                var action = new SponsorpayAction(_.extend({
                    id      : _.uniqueId("hook_"),
                    itemId  : this.getFirstCurrency().id
                }, options));

                this.trigger("hooks:add", action, {url : options.assetUrl});
                this.hooks.hooksMap[action.id] = action;

                // Start by adding the provider.  If it exists, the add operation will be ignored
                var provider = this.hooks.providers.getOrAdd(providerId);
                provider.getActions().add(action);
                this.hooks.offerHooks.add(action);

                return action;
            }

            return undefined;
        },
        removeHook : function(hook) {

            // Notify store
            this.trigger("hooks:remove", hook);

            // Remove model
            delete this.hooks.hooksMap[hook.id];
            this.hooks.removeHook(hook);
        },
        getOfferHooks : function() {
            return this.hooks.getOfferHooks();
        },

        // Unused
        getHook : function(provider, options) {
            return this.hooks.getHook(provider, options || {});
        },
        getHookById : function(id) {
            return this.hooks.hooksMap[id];
        },
        getProvider : function(id) {
            return this.hooks.getProvider(id);
        },
        getHookProviders : function() {
            return this.hooks.getProviders();
        }
    };


    return {
        HookManager : HookManager,
        HooksMixin  : HooksMixin,
        Action      : Action,
        Providers : {
            SponsorpayAction : SponsorpayAction
        }
    };
});
