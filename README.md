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

###About waitFor([id, ...])
Note that calls to `dispatcher.waitFor` must happen during a dispatch or the
invariant will throw an error. In other words that call always appears in a
registered dispatch callback.

    page.dispatcher.register(function(payload) {
      if (some-source-and-type-stuff) {
        page.dispatcher.waitFor([foo.dispatchId, bar.dispatchId]);
        
        // do stuff knowing that foo and bar stores callbacks have been called
      }
    });

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
    
So, using the convenience method you are left simply to attach the properties
to your action and send it along. Let's breakdown the keys and values that might
appear on an action:

+ **type**. This is the closest we come to a mandatory attribute for an action, 
though there may be occassions when `source` alone is enough for a given store.
The value is the **subject** to which something just happened. Though this 
property varies we should be able to standardize around something concrete. 
The use of `concern` (see below) can further help to keep this value limited to 
something with meaning.

+ **concern**. Views need to provide information when dispatching. In an attempt
to standardize the nomenclature around actions we will use _CRUD_ verbs to help
differentiate dispatches where `type` may be the same. An example would be 2
child views who both dispatch events related to user actions pertaining to a 
subject "foo":

    // some view owns the actions where a user creates a foo
    page.dispatcher.dispatchViewAction({
      type: "foo",
      concern: "create",
      data: {baz: "qux"}
    });
    
    // some other view owns the action where foo is deleted
    page.dispatcher.dispatchViewAction({
      type: "foo",
      concern: "delete",
      data: fooId
    });
    
The point being that the `type` here is the subject which can, preferably, remain
something meaningful to the domain, "foo" in this case. We could have easily
performed this without the added `concern` attribute, opting instead for varied
`type` props like `create-foo` and `fooDeleted`. My concern there is that we may
see **many** varied types of custom "type names". Keeping `type` restricted to
subject and using **only** _create_, _read_, _update_, _delete_ prevents that.

Worth noting is the _CRUD_ verb used by the action does not map directly to
a data-domain operation. It will be up to the stores interested in this action
to decide what to do with it. We should think of these things in the
**polymorphic** sense that this is an interpretation of an event. A `concern` of
_create_ can cover any sort of "newish" occurance. Same for the the other verbs...

###Action Creators
Generally views can dispatch actions when needed. Sometimes, however, you may
need to step outside of the logical scope of your view when dispatching, or you
may be able to use an action that is available globally to all views and the router.
These methods belong to the `page.actions` namespace and are defined both at the
`application` level and by the domain-manifest currently being used(Sheets, RFIs etc...)

We sequester these methods in either the `action_creators/application.js` or the 
`view_actions` and `route_actions` files unique to each domain, `action_creators/rfis/route_actions`
for example. These should be something very specific so naming clashes will not
be a problem. Some good naming conventions to follow are using `informFoo` when
introducing new data into the system such as the globally available:

    page.actions.informRoute("bar", {...});
    
Or actions specific to the user doing things:

    page.actions.downloadReportSelected({...});
    
Routing actions name should reflect their purpose:

    page.actions.showRouteCalled({...});

There is a little philosophy involved in the scope of views dispatching actions and
delegating to action creators. For example, the router chooses to use a
creator when `new` type routes are called because a `store` may need to be created.
The following located in the `route_actions` for the "RFIs Router":

    newRouteCalled: function newRouteCalled(cons) {

      var m = new PG.Models.Rfi();

      page.dispatcher.dispatchRouteAction({
        type: "new_",
        constructor: cons,
        data: {model: m}
      });

    }
    
While it is the logical domain of a router to understand routes and the view
constructors that will be called upon to handle them, it is not in it's 
responsibilities to make data stores. Even though the route_actions creators
are associated with the router, they are not *tightly* coupled to it and they do
provide the place to expand scope. This may be stretching [Demeter's Law](http://en.wikipedia.org/wiki/Law_of_Demeter) 
somewhat but the elasticity we build in here will prevent over-engineering in the future.


##Views
And, [a link](http://facebook.github.io/flux/docs/overview.html#views-and-controller-views)
