PG-Flux
=======

####1.21 gigawatts of awesome

##Unidirectional data flow, see?
Because, [flow-chart](http://www.gliffy.com/go/publish/6568579).

##Stores
First, take a look at [this](http://facebook.github.io/flux/docs/overview.html#stores).

####Backbone Models and Collections as Stores
Using these as flux data stores works well, but with a few mental adjustments
for the developer.

+ Getters are publicly available, but **not setters**. There is only one path
into the store, through the dispatcher via the callback a store registers.

+ We don't encourage views to save references to a store as `this.model` or 
`this.collection`.

+ Stores are instantiated before views via your `foo.html.erb` page or 
`route action creators`. Views cannot create data stores

+ Stores, at their discretion, will trigger the `change:emit` event after
updating (due to a dispatcher callback for example). This is the **only** event
that views may listen to on any store. The other events provided by backbone are
available internally for a store, or within the data-domain

+ Stores may know about other stores when appropriate and may choose to queue
their updates to come after others via `waitFor`

+ ...other differences vs the typical Backbone MVC pertaining to Models/Collections

Stores register **a single** callback with the dispatcher and save the returned
value as `this.dispatchId`. That property can be used by other stores as an argument
to `dispatcher.waitFor(...)`. When an action is dispatched the store will 
recieve the dispatcher `payload` as the argument to its registered callback
and decide what to do with it based on a few pieces of data included in the `payload`

+ The `payload.source`. This will always be `page.constants.ROUTE_SOURCE` or 
`page.constants.VIEW_SOURCE`
+ The `payload.action.type`. This property varies
+ the `payload.action.concern`. Used by views to differentiate when _source_ 
and _type_ properties are the same among actions. We use **CRUD** verbs for `concern`

Stores can register their callbacks with the dispatcher in their `init` method:

    init: {
  
      this.dispatchId = page.dispatcher.register(function(payload) {
        
        // the initial check is for source
        
        // if your store is interested in actions sent by the router
        if (payload.source === page.constants.ROUTE_SOURCE) {
          
          // you can handle actions here or call named methods
          this.handleRouteAction(payload.action);
        }
        
      }.bind(this));
    }

Pivoting on `source` and `type`:

    // assuming the same setup...
    if (payload.source === page.constants.VIEW_SOURCE) {
  
      // Discuss: let's try to keep the type attribute to something concrete
      if (payload.action.type === "foo") {
      
        this.handleFoo(payload.action);
      }
  
    }
  
An example of a the above handler that pivots based on `concern`:

    handleFoo: function handleFoo(action) {
      switch(action.concern) {
      
        case "update":
          this.set(action.data);
        break;
        
        case "delete":
          this.unset(action.data);
        break;
      }
      
      this.emitChange();
    }

  
##The Dispatcher
From the flux docs [here](http://facebook.github.io/flux/docs/overview.html#what-about-that-dispatcher).

Actions are sent to the dispatcher by **2** sources:

1. The Router, including its associated `route_actions` action creators
2. Views, including their associated `view_actions` action creators

Remember that Stores register with the dispatcher when istantiated and that the
dispatcher sends every dispatched payload to every registered callback.

The dispatcher also makes use of the `invariant` development tool and will throw
an error if cyclical dependency (via `waitFor`) is detected or **cascading dispatches**
occur.

####On Cascading Dispatches
If, during a dispatch callback another dispatch is attempted you will get the
"cannot dispatch in the middle of a dispatch" error. It's a nice way to indicate 
you are doing it wrong. Some common causes:

+ You are trying to call `dispatcher.dispatch` in the initialization phase of
a child view. Remember that the `page.currentView` is set by the `ViewManager`
during a dispatch callback so this will get you every time

Looking at the above a little more in-depth. In every instance that I have seen
this the developer is trying to get some data to a store that should already be
there. I find this is due to an old "MVC" habit where views set data into models,
particularly at "init" time.

##Actions
So, you [get the idea](http://facebook.github.io/flux/docs/overview.html#actions).

We have 2 primary types of actions. Those sent from the `Router` and those sent
via `Views`. With this in mind we have 2 specialized methods on the dispatcher that you can use,
`page.dispatcher.dispatchRouteAction` and `page.dispatcher.dispatchViewAction`. These methods
wrap your action in an object with the `source` property set correctly. Your router 
and its associated `route_action` creators will dispatch via the former:

    page.dispatcher.dispatchRouteAction({
      type: "index",
      ...
    });
    
without that convenience method you would have to do this:

    page.dispatcher.dispatch({
      source: page.constants.ROUTE_SOURCE,
      action: {
        type: "index",
        ...
      }
    });

##Views
And, [a link](http://facebook.github.io/flux/docs/overview.html#views-and-controller-views)
