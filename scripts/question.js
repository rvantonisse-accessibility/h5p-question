H5P.Question = (function ($, EventDispatcher, JoubelUI) {

  /**
   * Extending this class make it alot easier to create tasks for other
   * content types.
   *
   * @class H5P.Question
   * @extends H5P.EventDispatcher
   * @param {string} type
   */
  function Question(type) {
    var self = this;

    // Inheritance
    EventDispatcher.call(this);

    // Register default order
    self.order = ['image', 'introduction', 'content', 'feedback', 'buttons'];

    // Keep track of registered sections
    var sections = {};

    // Buttons
    var buttons = {};
    var buttonOrder = [];

    // Wrapper when attached
    var $wrapper;

    // ScoreBar
    var scoreBar;

    // Keep track of the feedback's visual status.
    var showFeedback;

    // Keep track of which buttons are scheduled for hiding.
    var buttonsToHide = [];

    // Keep track of which buttons are scheduled for showing.
    var buttonsToShow = [];

    // Keep track of the hiding and showing of buttons.
    var toggleButtonsTimer;

    // Keeps track of initialization of question
    var initialized = false;

    /**
     * @type {Object} behaviour Behaviour of Question
     * @property {Boolean} behaviour.disableFeedback Set to true to disable feedback section
     */
    var behaviour = {
      disableFeedback: false
    };

    // Keeps track of thumb state
    var imageThumb = true;

    // Keeps track of image transitions
    var imageTransitionTimer;

    // Keep track of whether sections is transitioning.
    var sectionsIsTransitioning = false;

    /**
     * Register section with given content.
     *
     * @private
     * @param {string} section ID of the section
     * @param {(string|H5P.jQuery)} content
     */
    var register = function (section, content) {
      sections[section] = {};
      var $e = sections[section].$element = $('<div/>', {
        'class': 'h5p-question-' + section,
      });
      if (content) {
        $e[content instanceof $ ? 'append' : 'html'](content);
      }
    };

    /**
     * Update registered section with content.
     *
     * @private
     * @param {string} section ID of the section
     * @param {(string|H5P.jQuery)} content
     */
    var update = function (section, content) {
      if (content instanceof $) {
        sections[section].$element.html('').append(content);
      }
      else {
        sections[section].$element.html(content);
      }
    };

    /**
     * Insert element with given ID into the DOM.
     *
     * @private
     * @param {array} order
     * List with ordered element IDs
     * @param {string} id
     * ID of the element to be inserted
     * @param {Object} elements
     * Maps ID to the elements
     * @param {H5P.jQuery} $container
     * Parent container of the elements
     */
    var insert = function (order, id, elements, $container) {
      // Try to find an element id should be after
      for (var i = 0; i < order.length; i++) {
        if (order[i] === id) {
          // Found our pos
          while (i > 0 &&
          (elements[order[i - 1]] === undefined ||
          !elements[order[i - 1]].$element.is(':visible'))) {
            i--;
          }
          if (i === 0) {
            // We are on top.
            elements[id].$element.prependTo($container);
          }
          else {
            // Add after element
            elements[id].$element.insertAfter(elements[order[i - 1]].$element);
          }
          break;
        }
      }
    };

    /**
     * Set element max height, used for animations.
     *
     * @param {H5P.jQuery} $element
     */
    var setElementHeight = function ($element) {
      if (!$element.is(':visible')) {
        // No animation
        $element.css('max-height', 'none');
        return;
      }

      // Get natural element height
      var $tmp = $element.clone()
        .css({
          'position': 'absolute',
          'max-height': 'none'
        }).appendTo($element.parent());

      // Apply height to element
      var h = $tmp.height();
      $element.css('max-height', h);
      $tmp.remove();
      return h;
    };

    /**
     * Does the actual job of hiding the buttons scheduled for hiding.
     *
     * @private
     */
    var hideButtons = function () {
      for (var i = 0; i < buttonsToHide.length; i++) {
        // Using detach() vs hide() makes it harder to cheat.
        buttons[buttonsToHide[i]].$element.detach();
      }
      buttonsToHide = [];
    };

    /**
     * Shows the buttons on the next tick. This is to avoid buttons flickering
     * If they're both added and removed on the same tick.
     *
     * @private
     */
    var toggleButtons = function () {
      // Show buttons
      for (var i = 0; i < buttonsToShow.length; i++) {
        insert(buttonOrder, buttonsToShow[i], buttons, sections.buttons.$element);
      }
      buttonsToShow = [];

      // Hide buttons
      for (var j = 0; j < buttonsToHide.length; j++) {
        if (buttons[buttonsToHide[j]].$element.is(':focus')) {
          // Move focus to the first visible button.
          self.focusButton();
        }
      }

      if (sections.buttons && buttonsToHide.length === sections.buttons.$element.children().length) {
        // All buttons are going to be hidden. Hide container using transition.
        sections.buttons.$element.removeClass('h5p-question-visible');
        sections.buttons.$element.css('max-height', '');
        sectionsIsTransitioning = true;

        // Wait for animations before detaching buttons
        setTimeout(function () {
          hideButtons();
          sectionsIsTransitioning = false;
        }, 150);
      }
      else {
        hideButtons();

        // Show button section
        if (!sections.buttons.$element.is(':empty')) {
          sections.buttons.$element.addClass('h5p-question-visible');
          setElementHeight(sections.buttons.$element);

          // Trigger resize after animation
          setTimeout(function () {
            self.trigger('resize');
          }, 150);
        }
      }

      // Resize buttons to fit container
      resizeButtons();

      toggleButtonsTimer = undefined;
    };

    /**
     * Allows for scaling of the question image.
     *
     * @param {H5P.jQuery} $img
     */
    var scaleImage = function ($img) {
      var transitionTimer;
      if (imageThumb) {
        // Find our target height
        var $tmp = $img.clone()
          .css('max-height', 'none').appendTo($img.parent());
        var targetHeight = $tmp.height();
        var targetWidth = $tmp.width();
        var canUseTotalWidth = targetWidth >= sections.image.$element.width();
        transitionTimer = 0;
        $tmp.remove();

        clearTimeout(imageTransitionTimer);
        sections.image.$element.addClass('h5p-question-image-large');

        // Only remove margins of section if image can use it.
        if (canUseTotalWidth && !sections.image.$element.hasClass('h5p-question-image-fill-width')) {
          transitionTimer = 300;
          sections.image.$element.addClass('h5p-question-image-fill-width');
        }

        // Animate to full size after animating it into place
        imageTransitionTimer = setTimeout(function () {
          $img.css('maxHeight', targetHeight);
        }, transitionTimer);
        imageThumb = false;
      }
      else {
        clearTimeout(imageTransitionTimer);
        transitionTimer = 0;
        $img.css('maxHeight', '');

        // Let image scale down before repositioning it
        if (sections.image.$element.hasClass('h5p-question-image-large')) {
          transitionTimer = 300;
        }
        sections.image.$element.removeClass('h5p-question-image-large');

        // Reposition image after scaling it
        imageTransitionTimer = setTimeout(function () {
          sections.image.$element.removeClass('h5p-question-image-fill-width');
        }, transitionTimer);


        imageThumb = true;
      }
    };

    /**
     * Get scrollable ancestor of element
     *
     * @private
     * @param {H5P.jQuery} $element
     * @returns {H5P.jQuery} Parent element that is scrollable
     */
    var findScrollableAncestor = function ($element) {
      if (!$element) {
        return; // Not found
      }

      if ($element.css('overflow-y') === 'auto') {
        return $element;
      }
      else {
        return findScrollableAncestor($element.parent());
      }
    };

    /**
     * Scroll to bottom of Question.
     *
     * @private
     */
    var scrollToBottom = function () {
      if (!$wrapper || ($wrapper.hasClass('h5p-standalone') && !H5P.isFullscreen)) {
        return; // No scroll
      }

      var scrollableAncestor = findScrollableAncestor($wrapper);

      // Scroll to bottom of scrollable ancestor
      if (scrollableAncestor) {
        scrollableAncestor.animate({
          scrollTop: $wrapper.css('height')
        }, "slow");
      }
    };

    /**
     * Resize sections, used for resizing sections when question is resized.
     *
     * @private
     */
    var resizeSections = function () {
      // Necessary when content changes, for example when entering full screen
      if (sections.feedback && showFeedback) {
        setElementHeight(sections.feedback.$element);
      }

      if (sections.buttons) {
        setElementHeight(sections.buttons.$element);
      }
    };

    /**
     * Resize buttons to fit container width
     *
     * @private
     */
    var resizeButtons = function () {
      if (!buttons || !sections.buttons) {
        return;
      }

      // A static margin is added as buffer for smoother transitions
      var staticMargins = 2;
      var buttonsWidth = 0;
      for (var i in buttons) {
        var $element = buttons[i].$element;
        if (buttons[i].isVisible) {
          // Round up
          buttonsWidth += Math.ceil($element.outerWidth(true)) + staticMargins;
        }
      }

      // Add static margins to final widths.
      buttonsWidth = buttonsWidth + staticMargins;

      // Allow button section to attach before getting width
      setTimeout(function () {
        var buttonSectionWidth = Math.floor(sections.buttons.$element.width()) - staticMargins;
        if (buttonsWidth >= buttonSectionWidth) {
          removeButtonLabels(buttonsWidth, buttonSectionWidth);
        }
        else {
          restoreButtonLabels(buttonsWidth, buttonSectionWidth);
        }
      }, 0);
    };

    /**
     * Remove button labels until they use less than max width.
     *
     * @private
     * @param {Number} buttonsWidth Total width of all buttons
     * @param {Number} maxButtonsWidth Max width allowed for buttons
     */
    var removeButtonLabels = function (buttonsWidth, maxButtonsWidth) {
      // Reverse traversal
      for (var i = buttonOrder.length - 1; i >= 0; i--) {
        var buttonId = buttonOrder[i];
        if (!buttons[buttonId].isTruncated && buttons[buttonId].isVisible) {
          var $button = buttons[buttonId].$element;
          var $tmp = $button.clone()
            .css({
              'position': 'absolute',
              'white-space': 'nowrap',
              'max-width': 'none'
            })
            .addClass('truncated')
            .html('')
            .appendTo($button.parent());

          // Calculate new total width of buttons
          buttonsWidth = buttonsWidth - $button.outerWidth(true) + $tmp.outerWidth(true);

          // Remove label
          $button.html('');
          $button.addClass('truncated');
          buttons[buttonId].isTruncated = true;
          $tmp.remove();
          if (buttonsWidth < maxButtonsWidth) {
            // Buttons are small enough.
            return;
          }
        }
      }
    };

    /**
     * Restore button labels until it fills maximum possible width without exceeding the max width.
     *
     * @private
     * @param {Number} buttonsWidth Total width of all buttons
     * @param {Number} maxButtonsWidth Max width allowed for buttons
     */
    var restoreButtonLabels = function (buttonsWidth, maxButtonsWidth) {
      for (var i = 0; i < buttonOrder.length; i++) {
        var buttonId = buttonOrder[i];
        if (buttons[buttonId].isTruncated && buttons[buttonId].isVisible) {
          // Check if adding label exceeds allowed width
          var $button = buttons[buttonId].$element;
          var $tmp = $button.clone()
            .css({
              'position': 'absolute',
              'white-space': 'nowrap',
              'max-width': 'none'
            }).removeClass('truncated')
            .html(buttons[buttonId].text)
            .appendTo($button.parent());

          // Calculate new total width of buttons
          buttonsWidth = buttonsWidth - $button.outerWidth(true) + $tmp.outerWidth(true);

          $tmp.remove();
          if (buttonsWidth >= maxButtonsWidth) {
            return;
          }
          // Restore label
          $button.html(buttons[buttonId].text);
          $button.removeClass('truncated');
          buttons[buttonId].isTruncated = false;
        }
      }
    };

    /**
     * Set behaviour for question.
     *
     * @param {Object} options An object containing behaviour that will be extended by Question
     */
    self.setBehaviour = function (options) {
      $.extend(behaviour, options);
    };

    /**
     * Add task image.
     *
     * @param {string} path Relative
     * @param {string} [alt] Text representation
     */
    self.setImage = function (path, alt) {
      sections.image = {};
      // Image container
      sections.image.$element = $('<div/>', {
        'class': 'h5p-question-image',
      });

      // Inner wrap
      var $imgWrap = $('<div/>', {
        'class': 'h5p-question-image-wrap',
        appendTo: sections.image.$element
      });

      // Image element
      var $img = $('<img/>', {
        src: H5P.getPath(path, this.contentId),
        alt: (alt === undefined ? '' : alt),
        on: {
          load: function () {
            // Determine max size
            $img.css('maxHeight', 'none');
            // var maxWidth = this.width;
            var maxHeight = this.height;

            // Determine thumb size
            $img.css('maxHeight', '');
            if (maxHeight > this.height) {
              // We can do better. Add resize capability
              $img.attr('role', 'button').attr('tabIndex', '0');
              $imgWrap.addClass('h5p-question-image-scalable')
                .on('click', function (event) {
                  if (event.which === 1) {
                    scaleImage($img); // Left mouse button click
                  }
                }).on('keypress', function (event) {
                  if (event.which === 32) {
                    scaleImage($img); // Space bar pressed
                  }
                });
            }

            self.trigger('imageLoaded', this);
          }
        },
        appendTo: $imgWrap
      });

      return self;
    };

    /**
     * Add the introduction section.
     *
     * @param {(string|H5P.jQuery)} content
     */
    self.setIntroduction = function (content) {
      register('introduction', content);

      return self;
    };

    /**
     * Add the content section.
     *
     * @param {(string|H5P.jQuery)} content
     * @param {Object} [options]
     * @param {string} [options.class]
     */
    self.setContent = function (content, options) {
      register('content', content);

      if (options && options.class) {
        sections.content.$element.addClass(options.class);
      }

      return self;
    };

    /**
     * Set feedback message.
     * Setting the message to blank or undefined will hide it again.
     *
     * @param {string} content
     * @param {number} score The score
     * @param {number} maxScore The maximum score for this question
     */
    self.setFeedback = function (content, score, maxScore) {

      // Feedback is disabled
      if (behaviour.disableFeedback) {
        return self;
      }

      if (content) {
        var $feedback = $('<div>', {
          'class': 'h5p-question-feedback-container'
        });

        if (scoreBar === undefined) {
          scoreBar = JoubelUI.createScoreBar(maxScore);
        }
        scoreBar.appendTo($feedback);
        scoreBar.setScore(score);
        $feedback.append($('<div>', {
          'class': 'h5p-question-feedback-content',
          'html': content
        }));

        showFeedback = true;
        if (sections.feedback) {
          // Update section
          update('feedback', $feedback);
        }
        else {
          // Create section
          register('feedback', $feedback);
          if (initialized && $wrapper) {
            insert(self.order, 'feedback', sections, $wrapper);
          }
        }
        // Show feedback section
        setTimeout(function () {
          sections.feedback.$element.addClass('h5p-question-visible');
          setElementHeight(sections.feedback.$element);
          sectionsIsTransitioning = true;

          // Scroll to bottom after showing feedback
          scrollToBottom();

          // Trigger resize after animation
          setTimeout(function () {
            sectionsIsTransitioning = false;
            self.trigger('resize');
          }, 150);
        }, 0);

      }
      else if (sections.feedback && showFeedback) {
        showFeedback = false;

        // Hide feedback section
        sections.feedback.$element.removeClass('h5p-question-visible');
        sections.feedback.$element.css('max-height', '');
        sectionsIsTransitioning = true;

        // Detach after transition
        setTimeout(function () {
          // Avoiding Transition.onTransitionEnd since it will register multiple events, and there's no way to cancel it if the transition changes back to "show" while the animation is happening.
          if (!showFeedback) {
            sections.feedback.$element.children().detach();

            // Trigger resize after animation
            self.trigger('resize');
          }
          sectionsIsTransitioning = false;
          scoreBar.setScore(0);
        }, 150);
      }

      return self;
    };

    /**
     * Set feedback content (no animation).
     *
     * @param {string} content
     * @param {boolean} [extendContent] True will extend content, instead of replacing it
     */
    self.updateFeedbackContent = function (content, extendContent) {
      if (sections.feedback && sections.feedback.$element) {

        if (extendContent) {
          content = $('.h5p-question-feedback-content', sections.feedback.$element).html() + ' ' + content;
        }

        // Update feedback content html
        $('.h5p-question-feedback-content', sections.feedback.$element).html(content);
      }

      return self;
    };

    /**
     * Checks to see if button is registered.
     *
     * @param {string} id
     * @returns {boolean}
     */
    self.hasButton = function (id) {
      return (buttons[id] !== undefined);
    };

    /**
     * Register buttons for the task.
     *
     * @param {string} id
     * @param {string} text label
     * @param {function} clicked
     * @param {boolean} [visible=true]
     */
    self.addButton = function (id, text, clicked, visible) {
      if (buttons[id]) {
        return self; // Already registered
      }

      if (sections.buttons === undefined)  {
        // We have buttons, register wrapper
        register('buttons');
        if (initialized) {
          insert(self.order, 'buttons', sections, $wrapper);
        }
      }

      buttons[id] = {
        isTruncated: false,
        text: text
      };
      var $e = buttons[id].$element = JoubelUI.createButton({
        'class': 'h5p-question-' + id,
        html: text,
        on: {
          click: function () {
            clicked();
          }
        }
      });
      buttonOrder.push(id);

      if (visible === undefined || visible) {
        // Button should be visible
        $e.appendTo(sections.buttons.$element);
        buttons[id].isVisible = true;
        sections.buttons.$element.addClass('h5p-question-visible');
      }

      return self;
    };

    /**
     * Show registered button with given identifier.
     *
     * @param {string} id
     */
    self.showButton = function (id) {
      if (buttons[id] === undefined) {
        return self;
      }

      // Skip if already being shown
      if (buttonsToShow.indexOf(id) !== -1 || buttons[id].$element.is(':visible')) {
        return self;
      }

      buttons[id].isVisible = true;

      // Check if button is going to be hidden on next tick
      var exists = buttonsToHide.indexOf(id);
      if (exists !== -1) {

        // Just skip hiding it
        buttonsToHide.splice(exists, 1);
      } else {

        // Show button on next tick
        buttonsToShow.push(id);
      }

      if (!toggleButtonsTimer) {
        toggleButtonsTimer = setTimeout(toggleButtons, 0);
      }

      return self;
    };

    /**
     * Hide registered button with given identifier.
     *
     * @param {string} id
     */
    self.hideButton = function (id) {
      if (buttons[id] === undefined) {
        return self;
      }

      // Skip if already being hidden
      if (buttonsToHide.indexOf(id) !== -1) {
        return self;
      }

      buttons[id].isVisible = false;

      // Check if buttons is going to be shown on next tick
      var exists = buttonsToShow.indexOf(id);
      if (exists !== -1) {

        // Just skip showing it
        buttonsToShow.splice(exists, 1);
      } else if (!buttons[id].$element.is(':visible')) {

        // Make sure it is detached in case the container is hidden.
        buttons[id].$element.detach();
      } else {

        // Hide button on next tick.
        buttonsToHide.push(id);
      }

      if (!toggleButtonsTimer) {
        toggleButtonsTimer = setTimeout(toggleButtons, 0);
      }

      return self;
    };

    /**
     * Set focus to the given button. If no button is given the first visible
     * button gets focused. This is useful if you lose focus.
     *
     * @param {string} [id]
     */
    self.focusButton = function (id) {
      if (id === undefined) {
        // Find first button that is visible.
        for (var i = 0; i < buttonOrder.length; i++) {
          if (buttons[buttonOrder[i]].isVisible) {
            // Give that button focus
            buttons[buttonOrder[i]].$element.focus();
            break;
          }
        }
      }
      else if (buttons[id].$element.is(':visible')) {
        // Set focus to requested button
        buttons[id].$element.focus();
      }

      return self;
    };

    /**
     * Set new element for section.
     *
     * @param {String} id
     * @param {H5P.jQuery} $element
     */
    self.insertSectionAtElement = function (id, $element) {
      if (sections[id] === undefined) {
        register(id);
      }
      sections[id].parent = $element;

      // Insert section if question is not initialized
      if (!initialized) {
        insert([id], id, sections, $element);
      }

      return self;
    };

    /**
     * Attach content to given container.
     *
     * @param {H5P.jQuery} $container
     */
    self.attach = function ($container) {
      this.setActivityStarted();

      // The first time we attach we also create our DOM elements.
      if ($wrapper === undefined) {
        if (self.registerDomElements !== undefined &&
           (self.registerDomElements instanceof Function ||
           typeof self.registerDomElements === 'function')) {

           // Give the question type a chance to register before attaching
           self.registerDomElements();
        }
        self.trigger('registerDomElements');
      }

      // Prepare container
      $wrapper = $container;
      $container.html('').addClass('h5p-question h5p-' + type);

      // Add sections in given order
      var $sections = [];
      for (var i = 0; i < self.order.length; i++) {
        var section = self.order[i];
        if (sections[section]) {
          if (sections[section].parent) {
            // Section has a different parent
            sections[section].$element.appendTo(sections[section].parent);
          } else {
            $sections.push(sections[section].$element);
          }
        }
      }

      // Only append once to DOM for optimal performance
      $container.append($sections);

      // ??
      this.trigger('domChanged', {
        '$target': $container,
        'library': 'TODO',
        'contentId': this.contentId,
        'key': 'newLibrary'
      }, {'bubbles': true, 'external': true});

      // ??
      initialized = true;

      return self;
    };

    /**
     * Detach all sections from their parents
     */
    self.detachSections = function () {
      // Deinit Question
      initialized = false;

      // Detach sections
      for (var section in sections) {
        sections[section].$element.detach();
      }

      return self;
    };

    /**
     * Getter for question wrapper
     */
    self.getQuestionContainer = function () {
      return $wrapper;
    };

    // Listen for resize
    this.on('resize', function () {
      // Allow elements to attach and set their height before resizing
      if (!sectionsIsTransitioning) {
        resizeSections();
      }

      resizeButtons();
    });
  }

  // Inheritance
  Question.prototype = Object.create(EventDispatcher.prototype);
  Question.prototype.constructor = Question;

  return Question;
})(H5P.jQuery, H5P.EventDispatcher, H5P.JoubelUI);
