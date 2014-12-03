/**
 * Custom build of the flux.Dispatcher
 *
 * Dispatcher is used to broadcast payloads to registered callbacks. This is
 * different from generic pub-sub systems in two ways:
 *
 *   1) Callbacks are not subscribed to particular events. Every payload is
 *      dispatched to every registered callback.
 *   2) Callbacks can be deferred in whole or part until other callbacks have
 *      been executed.
 *
 * For example, consider this hypothetical flight destination form, which
 * selects a default city when a country is selected:
 *
 *   page.dispatcher is always available
 *
 *   // Keeps track of which country is selected
 *   var CountryStore = {country: null};
 *
 *   // Keeps track of which city is selected
 *   var CityStore = {city: null};
 *
 *   // Keeps track of the base flight price of the selected city
 *   var FlightPriceStore = {price: null}
 *
 * When a user changes the selected city, we dispatch the payload:
 *
 *   dispatcher.dispatchViewAction({
 *     type: "city-update",
 *     selectedCity: "paris"
 *   });
 *
 * This payload is digested by `CityStore`:
 *
 *   dispatcher.register(function(payload) {
 *     if (payload.action.type === "city-update") {
 *       this.city = payload.selectedCity;
 *     }
 *   }.bind(this));
 *
 * When the user selects a country, we *could* dispatch the payload thus:
 *
 *   dispatcher.dispatch({
 *     source: page.constants.VIEW_SOURCE,
 *     action: {
 *       type: "country-update",
 *       selectedCountry: "australia"
 *     }
 *   });
 *
 * This payload is digested by both stores:
 *
 *    CountryStore.dispatchId = dispatcher.register(function(payload) {
 *     if (payload.action.type === "country-update") {
 *       this.country = payload.selectedCountry;
 *     }
 *   }.bind(this));
 *
 * When the callback to update `CountryStore` is registered, we save a reference
 * to the returned Id. Using this token with `waitFor()`, we can guarantee
 * that `CountryStore` is updated before the callback that updates `CityStore`
 * needs to query its data.
 *
 *   CityStore.dispatchId = dispatcher.register(function(payload) {
 *     if (payload.action.type === "country-update") {
 *       // `CountryStore.country` may not be updated.
 *       dispatcher.waitFor([CountryStore.dispatchId]);
 *       // `CountryStore.country` is now guaranteed to be updated.
 *
 *       // Select the default city for the new country
 *       this.city = this.getDefaultCityForCountry(CountryStore.country);
 *     }
 *   }.bind(this));
 *
 * The usage of `waitFor()` can be chained, for example:
 *
 *   FlightPriceStore.dispatchId =
 *     dispatcher.register(function(payload) {
 *       switch (payload.action.type) {
 *         case "country-update":
 *           dispatcher.waitFor([CityStore.dispatchId]);
 *           this.price =
 *             this.getFlightPriceStore(CountryStore.country, CityStore.city);
 *           break;
 *
 *         case "city-update":
 *           this.price =
 *             ...(CountryStore.country, CityStore.city);
 *           break;
 *     }
 *   });
 *
 * The `country-update` payload will be guaranteed to invoke the stores"
 * registered callbacks in order: `CountryStore`, `CityStore`, then
 * `FlightPriceStore`.
 */

PG.Dispatcher = function() {
  this.dispatcherCallbacks = {};
  this.dispatcherIsPending = {};
  this.dispatcherIsHandled = {};
  this.dispatcherIsDispatching = false;
  this.dispatcherPendingPayload = null;
};

/**
 * Registers a callback to be invoked with every dispatched payload. Returns
 * a token that can be used with `waitFor()`.
 *
 * @param {function} callback
 * @return {string}
 */
PG.Dispatcher.prototype.register=function(callback) {
  var id = _.uniqueId("ID_");
  this.dispatcherCallbacks[id] = callback;
  return id;
};

/**
 * Removes a callback based on its token.
 *
 * @param {string} id
 */
PG.Dispatcher.prototype.unregister=function(id) {
  page.invariant(
    this.dispatcherCallbacks[id],
    "Dispatcher.unregister(...): `%s` does not map to a registered callback.",
    id
  );
  delete this.dispatcherCallbacks[id];
};

/**
 * Waits for the callbacks specified to be invoked before continuing execution
 * of the current callback. This method should only be used by a callback in
 * response to a dispatched payload.
 *
 * @param {array<string>} ids
 */
PG.Dispatcher.prototype.waitFor=function(ids) {
  page.invariant(
    this.dispatcherIsDispatching,
    "Dispatcher.waitFor(...): Must be invoked while dispatching."
  );
  for (var ii = 0; ii < ids.length; ii++) {
    var id = ids[ii];
    if (this.dispatcherIsPending[id]) {
      page.invariant(
        this.dispatcherIsHandled[id],
        "Dispatcher.waitFor(...): Circular dependency detected while " +
        "waiting for `%s`.",
        id
      );
      continue;
    }
    page.invariant(
      this.dispatcherCallbacks[id],
      "Dispatcher.waitFor(...): `%s` does not map to a registered callback.",
      id
    );
    this.dispatcherInvokeCallback(id);
  }
};

/**
 * Dispatches a payload to all registered callbacks.
 *
 * @param {object} payload
 */
PG.Dispatcher.prototype.dispatch=function(payload) {
  page.invariant(
    !this.dispatcherIsDispatching,
    "Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch."
  );
  this.dispatcherStartDispatching(payload);
  try {
    for (var id in this.dispatcherCallbacks) {
      if (this.dispatcherIsPending[id]) {
        continue;
      }
      this.dispatcherInvokeCallback(id);
    }
  } finally {
    this.dispatcherStopDispatching();
  }
};

/**
 * Is this Dispatcher currently dispatching.
 *
 * @return {boolean}
 */
PG.Dispatcher.prototype.isDispatching=function() {
  return this.dispatcherIsDispatching;
};

/**
 * Call the callback stored with the given id. Also do some internal
 * bookkeeping.
 *
 * @param {string} id
 * @internal
 */
PG.Dispatcher.prototype.dispatcherInvokeCallback=function(id) {
  this.dispatcherIsPending[id] = true;
  this.dispatcherCallbacks[id](this.dispatcherPendingPayload);
  this.dispatcherIsHandled[id] = true;
};

/**
 * Set up bookkeeping needed when dispatching.
 *
 * @param {object} payload
 * @internal
 */
PG.Dispatcher.prototype.dispatcherStartDispatching=function(payload) {
  for (var id in this.dispatcherCallbacks) {
    this.dispatcherIsPending[id] = false;
    this.dispatcherIsHandled[id] = false;
  }
  this.dispatcherPendingPayload = payload;
  this.dispatcherIsDispatching = true;
};

/**
 * Clear bookkeeping used for dispatching.
 *
 * @internal
 */
PG.Dispatcher.prototype.dispatcherStopDispatching=function() {
  this.dispatcherPendingPayload = null;
  this.dispatcherIsDispatching = false;
};
/**
* The PG dispatcher api methods `handle*Action` take an action
* originating from a domain and append that information to a wrapper
* object around the action to be dispatched -- the combined data
* is what should be expected by registered dispatch callbacks
*
* payload = { source: ..., action: {...}}
*
* @internal
*/
PG.Dispatcher.prototype._handler=function(source, action) {
  var payload = {
    source: source,
    action: action
  };
  this.dispatch(payload);  
};

/**
* dispatched from the Router or its delegated action_creators
*/
PG.Dispatcher.prototype.dispatchRouteAction = function(action) {
  this._handler(page.constants.ROUTE_SOURCE, action);
};

/**
* dispatched from Views or their delegated action_creators
*/
PG.Dispatcher.prototype.dispatchViewAction = function(action) {
  this._handler(page.constants.VIEW_SOURCE, action);
};