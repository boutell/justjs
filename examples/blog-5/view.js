// ejs as we use it here is: https://github.com/visionmedia/ejs
// not the older version in google code, which is rather different

var ejs = require('ejs');
var _ = require('underscore');
var fs = require('fs');

var options;
var templates = {};

module.exports = view = {
  init: function init(optionsArg, callback)
  {
    options = optionsArg;
    if (!options.viewDir)
    {
      throw new Error("options.viewDir is required, please tell me where the views are");
    }
    callback();
  },

  // Render a page template nested in the layout, allowing slots 
  // (such as overrides of the page title) to be passed back to the layout.
  // Anything in data.slots is also passed down to any calls to partial().
  // Since data.slots is an object passed by reference, partials can change
  // data.slots.title, etc. and that will be seen by the layout
  page: function page(template, data)
  {
    if (!data)
    {
      data = {};
    }
    // Defaulting the crumbs slot to an empty array is helpful because
    // it saves having an explicit default for it in every partial.
    // Take care not to crush anything already in data.slots while still
    // adding our defaults if they are absent
    _.defaults(data, { slots: {} });
    _.defaults(data.slots, { crumbs: [], title: '', bodyClass: '' });
    data.slots.body = view.partial(template, data);
    // If a partial has already set the 'layout' slot, respect that instead
    // of the default layout name
    _.defaults(data.slots, { layout: 'layout' });
    // ... Or cancel the layout from a partial
    if (data.slots.layout === false)
    {
      return data.slots.body;
    }
    return view.partial(data.slots.layout, { slots: data.slots });
  },

  partial: function partial(template, data)
  {
    if (!data)
    {
      data = {};
    }
    // Avoid the use of _.defaults when computing the value is expensive;
    // test and make sure it's necessary

    // Compile the template if we haven't already
    if (!templates[template])
    {
      // Synchronous operations are a little outside the node spirit, but reading
      // small files from the filesystem is very fast, and we only do it once per template,
      // after which we have it cached
      templates[template] = ejs.compile(fs.readFileSync(options.viewDir + '/' + template + '.ejs', 'utf8'));
    }

    // Inject a partial() function for rendering another partial inside this one. 
    // All partials get to participate in overriding slots, unless we explicitly pass
    // a different 'slots' object at some level
    if (!data.partial)
    {
      data.partial = function(partial, partialData) {
        if (!partialData)
        {
          partialData = {};
        }
        _.defaults(partialData, { slots: data.slots });
        return view.partial(partial, partialData);
      };
    }

    // Create a slot context if we don't have one already from
    // the call we're nested in. Inject underscore so we can use
    // JS responsibly in templates
    _.defaults(data, { slots: {}, _: _ }); 

    // Render the template
    return templates[template](data);
  }
};
