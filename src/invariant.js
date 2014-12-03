/**
 * Custom build of the flux.invariant
 *
 * Use invariant() to assert state which your program assumes to be true.
 *
 * Provide sprintf-style format (only %s is supported) and arguments
 * to provide information about what broke and what you were
 * expecting.
 *
 * a noop if not in dev
 */

page.invariant = function(condition, format, a, b, c, d, e, f) {
  if(page.env !== "development") return;

  if (format === undefined) {
    throw new Error("invariant requires an error message argument");
  }

  if (!condition) {
    var error;
    if (format === undefined) {
      error = new Error(
        "Minified exception occurred; use the non-minified dev environment " +
        "for the full error message and additional helpful warnings."
      );
    } else {
      var args = [a, b, c, d, e, f];
      var argIndex = 0;
      error = new Error(
        "Invariant Violation: " +
        format.replace(/%s/g, function() { return args[argIndex++]; })
      );
    }
    
    // TODO what is framesToPop?
    error.framesToPop = 1; // we don"t care about invariant"s own frame
    throw error;
  }
};