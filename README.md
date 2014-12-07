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

##The Dispatcher
So, you [get the idea](http://facebook.github.io/flux/docs/overview.html#what-about-that-dispatcher).

Actions are sent to the dispatcher by **2** sources:

1. The Router, including its associated `route_actions` action creators
2. Views, including their associated `view_actions` action creators

Remember that Stores register with the dispatcher when istantiated. They will 
recieve **every** action that is raised

##Actions
From the flux docs [here](http://facebook.github.io/flux/docs/overview.html#actions).

##Views
And, [a link](http://facebook.github.io/flux/docs/overview.html#views-and-controller-views)
