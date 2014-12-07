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

##Actions
From the flux docs [here](http://facebook.github.io/flux/docs/overview.html#actions).

##The Dispatcher
So, you [get the idea](http://facebook.github.io/flux/docs/overview.html#what-about-that-dispatcher).

##Views
And, [a link](http://facebook.github.io/flux/docs/overview.html#what-about-that-dispatcher).
