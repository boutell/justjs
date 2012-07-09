function Justjs() {
  var ejs = require('ejs');
  // No double escape prevention (it's bad for rich text)
  ejs.filters.alwaysEscape = function(obj) {
    return String(obj)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };
  var appView;
  // Collection
  var posts;
  // Routes
  var controller;

  var dispatcher = {};
  _.extend(dispatcher, Backbone.Events);

  var Post = Backbone.Model.extend({
    idAttribute: 'slug'
  });

  var NewPost = Post.extend({
    url: '/api/v1/posts',
  });

  var Posts = Backbone.Collection.extend({
    model: Post,
    url: '/api/v1/posts'
  });

  var Controller = Backbone.Router.extend({
    routes: {
      "": "index",
      "posts/:slug": "post",
      "posts/:slug/edit": "edit"
    },

    index: function() {
      this.changePage('Home', [], IndexView, { collection: posts });
    },

    new: function() {
      appView.showNewPostView();
    },

    post: function(slug) {
      var matching = posts.where({ slug: slug });
      if (matching.length) {
        var post = matching[0];
        this.changePage(post.get('title'), [ { href: "/posts/" + post.get('slug'), title: post.get('title') } ], PostView, { model: post });
      }
      // TODO: reasonable error message
    },

    edit: function(slug) {
      var matching = posts.where({ slug: slug });
      if (matching.length) {
        var post = matching[0];
        this.changePage(post.get('title'), [ { href: "/posts/" + post.get('slug'), title: post.get('title') } ], EditView, { model: post });
      }
      // TODO: reasonable error message
    },

    changePage: function(title, crumbs, bodyViewType, bodyViewArgs) {
      appView.setTitle(title);
      appView.setCrumbs(crumbs);
      regressiveDeprivation($("[data-view='body']"));
      bodyViewArgs.el = $("[data-view='body']");
      appView.setBodyView(new bodyViewType(bodyViewArgs));
    }
  })

  var TitleView = Backbone.View.extend({
    tagName: "div",
    title: '',
    render: function() {
      this.$el.html('<h1></h1>');
      this.$('h1').text("justjs: " + this.title);
      $('title').text("justjs: " + this.title);
    },
    setTitle: function(title) {
      this.title = title;
    }
  });

  var CrumbsView = Backbone.View.extend({
    tagName: "div",
    crumbs: [],
    render: function() {
      template(this, 'crumbs', { slots: { crumbs: this.crumbs }});
      this.delegateEvents();
    },
    setCrumbs: function(crumbs)
    {
      this.crumbs = [{ href: '/', title: 'justjs' }];
      this.crumbs = this.crumbs.concat(crumbs);
    }
  });

  var AppView = Backbone.View.extend({
    tagName: "body",
    titleView: null,
    crumbsView: null,
    bodyView: null,
    initialize: function() {
      dispatcher.on('title', function(view, title) {
        if (this.bodyView === view)
        {
          this.setTitle(title);
        }
      });
    },
    setTitle: function(title) {
      this.titleView = new TitleView({ el: $("[data-view='title']") });
      this.titleView.setTitle(title);
      this.titleView.render();
    },
    setCrumbs: function(crumbs) {
      this.crumbsView = new CrumbsView({ el: $("[data-view='crumbs']") });
      this.crumbsView.setCrumbs(crumbs);
      this.crumbsView.render();
    },
    setBodyView: function(bodyView) {
      this.bodyView = bodyView;
      this.bodyView.render();
    },
    showNewPostView: function() {
      var post = new NewPost({ title: '', body: '' });
      this.newPostView = new PostView( { model: post, subview: true, el: $("[data-container='newPost']") } );
      // this.$('[data-container="newPost"]').html('');
      // this.$('[data-container="newPost"]').append(this.newPostView.$el);
    },
  });

  var PostView = Backbone.View.extend({
    tagName: "div",
    className: "post",
    slots: {},
    events: {
      "click [data-action='edit']": "edit",
      "click [data-action='delete']": "delete",
      "click [data-action='save']": "save",
      "click [data-action='cancel']": "cancel",
    },
    editing: false,

    initialize: function() {
      var self = this;
      if (self.model.isNew())
      {
        self.editing = true;
      }
      self.model.on('change', function() {
        self.render();
      });
      self.render();
    },

    edit: function(event) {
      event.preventDefault();
      this.editing = true;
      this.render();
    },

    delete: function(event) {
      event.preventDefault();
      this.model.destroy({
        success: function(model, response) {
          // We call controller.index directly because we want it to refresh
          // even if we are already on the homepage...
          controller.index();
          // But we still call controller.navigate to update the URL fragment
          // if we are not yet on the homepage. The default behavior of
          // controller.navigate is to *not* call the route handler,
          // so it's OK that we already did.
          controller.navigate('');
        }
      });
    },

    save: function(event) {
      event.preventDefault();
      this.editing = false;
      // Necessary before any save operation involving rich text
      this.$('.rich-text-editor').trigger('preSave');
      // In addition to saving the post, this will trigger a 'change' event 
      // on the model, which will result in a new render() call. We switched to
      // data-field rather than name to work around a ckeditor limitation
      var data = { title: this.$("[data-field='title']").val(), body: this.$("[data-field='body']").val() };
      var wasNew = this.model.isNew();
      this.model.save(data);
      if (wasNew)
      {
        posts.unshift(this.model);
      }
    },

    cancel: function(event) {
      if (this.model.isNew())
      {
        controller.index();
        return;
      }
      event.preventDefault();
      this.editing = false;
      this.render();
    },

    render: function() {
      if (this.editing)
      {
        template(this, 'edit', { post: this.model.toJSON(), subview: !!this.options.subview });
      }
      else
      {
        template(this, 'post', { post: this.model.toJSON(), subview: !!this.options.subview });
      }
      this.delegateEvents();
    },
  });

  var IndexView = Backbone.View.extend({
    events: {
      "click [data-action='new']": "new"
    },
    tagName: "div",
    className: "blog",
    initialize: function() {
      var self = this;
      self.render();
      self.collection.on('change', function() {
        self.render();
      });
    },
    new: function(event) {
      event.preventDefault();
      controller.new();
    },
    render: function() {
      var self = this;
      // Pass an empty posts array initially to satisfy the template
      this.$el.html(template(this, 'index', { posts: [] }));
      this.collection.each(function(post) {
        var postView = new PostView({ model: post, subview: true });
        self.$('[data-container="posts"]').append(postView.$el);
      });
    }
  });

  function partial(templateName, data)
  {
    if (!data)
    {
      data = {};
    }
    _.defaults(data, { slots: {} });
    _.defaults(data.slots, { crumbs: [], permissions: permissions });

    if (!data.partial)
    {
      data.partial = function(partialName, partialData) {
        if (!partialData)
        {
          partialData = {};
        }
        _.defaults(partialData, { slots: data.slots });
        return partial(partialName, partialData);
      };
    }

    if (!templates[templateName].compiled)
    {
      templates[templateName].compiled = ejs.compile(templates[templateName].source);
    }
    return templates[templateName].compiled(data);
  }

  function template(context, templateName, data)
  {
    // A tongue-in-cheek name for a function that reverses progressive
    // enhancements on the existing elements, in particular any that
    // can't be cleaned up just by removing the DOM elements
    regressiveDeprivation(context.$el);
    context.$el.html(partial(templateName, data));
    // Post an event if we set a title slot. This lets the
    // AppView and IndexView decide what should be done about it
    if (data.slots.title)
    {
      dispatcher.trigger('title', context, data.slots.title);
    }
    progressiveEnhancement(context.$el);
  }

  function regressiveDeprivation(sel)
  {
    $(sel).find('.rich-text-editor').trigger('preUnload');
  }

  function progressiveEnhancement(sel)
  {
    $(function() {

      // Turn textareas with the .rich-text-editor class into
      // CKEditors

      $(sel).find('.rich-text-editor').each(function() {
        var editor = CKEDITOR.replace(this);
        // If it's not a normal form submission we have to tell
        // ckeditor to update the original textarea
        $(this).bind('preSave', function() {
          editor.updateElement();
        });
        $(this).bind('preUnload', function() {
          editor.destroy(true);
          // Don't remove twice
          $(this).removeClass('.rich-text-editor');
        });
      });

      // Turn links with data-action='nav' into backbone links that
      // don't really load a new HTML page

      $(sel).find("[data-action='nav']").click(function(event) {
        event.preventDefault();
        var href = $(this).attr('href');
        controller.navigate(href.substr(1), { trigger: true });
      });
    });
  }

  this.init = function()
  {
    controller = new Controller();
    appView = new AppView({ el: $('body') });
    progressiveEnhancement('body');
    posts = new Posts();
    posts.fetch({ complete: function() {
      Backbone.history.start({pushState: true});  
    }});
  }
}

