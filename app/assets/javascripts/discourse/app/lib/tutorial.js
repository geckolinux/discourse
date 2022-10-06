import { iconHTML } from "discourse-common/lib/icon-library";
import I18n from "I18n";
import tippy from "tippy.js";

const GLOBAL_TUTORIALS_KEY = "new_user_tips";
const TUTORIAL_KEYS = ["first-notification", "topic-timeline"];

const instances = {};
const queue = [];

// Plugin used to implement actions of the two buttons
const TutorialPlugin = {
  name: "tutorial",

  fn(instance) {
    return {
      onCreate() {
        instance.popper
          .querySelector(".btn-primary")
          .addEventListener("click", (event) => {
            const { currentUser, tutorial } = instance.props;
            hideTutorialForever(currentUser, tutorial);
            event.preventDefault();
          });

        instance.popper
          .querySelector(".btn-flat")
          .addEventListener("click", (event) => {
            const { currentUser } = instance.props;
            hideTutorialForever(currentUser, GLOBAL_TUTORIALS_KEY);
            event.preventDefault();
          });
      },
    };
  },
};

function getUserOptionKey(tutorial) {
  return `skip_${tutorial.replaceAll("-", "_")}`;
}

export function showTutorial(options) {
  hideTutorial(options.tutorial);

  if (
    !options.reference ||
    !options.currentUser ||
    options.currentUser.get(getUserOptionKey(options.tutorial))
  ) {
    return;
  }

  if (Object.keys(instances).length > 0) {
    return addToQueue(options);
  }

  instances[options.tutorial] = tippy(options.reference, {
    placement: options.placement,

    plugins: [TutorialPlugin],

    // Current user is used to keep track of tutorials.
    currentUser: options.currentUser,

    // Key used to save state.
    tutorial: options.tutorial,

    // Tippy must be displayed as soon as possible and not be hidden unless
    // the user clicks on one of the two buttons.
    showOnCreate: true,
    hideOnClick: false,
    trigger: "manual",

    // It must be interactive to make buttons work.
    interactive: true,

    // The default max width is 350px and that is not enough to fit the
    // buttons.
    maxWidth: "none",
    arrow: iconHTML("tippy-rounded-arrow"),

    // It often happens for the reference element to be rerendered. In this
    // case, tippy must be rerendered too. Having an animation means that the
    // animation will replay over and over again.
    animation: false,

    // The `content` property below is HTML.
    allowHTML: true,

    content: `<div class='tutorial-popup-container'>
        <div class='tutorial-popup'>
          <div class='tutorial-title'>${options.titleText}</div>
          <div class='tutorial-content'>${options.contentText}</div>
          <div class='tutorial-buttons'>
            <button class="btn btn-primary">${
              options.primaryBtnText || I18n.t("tutorial.primary")
            }</button>
            <button class="btn btn-flat btn-text">${
              options.secondaryBtnText || I18n.t("tutorial.secondary")
            }</button>
          </div>
        </div>
      </div>`,
  });
}

export function hideTutorial(tutorial) {
  const instance = instances[tutorial];
  if (instance && !instance.state.isDestroyed) {
    instance.destroy();
  }
  delete instances[tutorial];
}

export function hideTutorialForever(user, tutorial) {
  if (!user) {
    return;
  }

  const tutorials =
    tutorial === GLOBAL_TUTORIALS_KEY
      ? [GLOBAL_TUTORIALS_KEY, ...TUTORIAL_KEYS]
      : [tutorial];

  // Destroy tippy instances
  tutorials.forEach(hideTutorial);

  // Update user options
  if (!user.user_option) {
    user.set("user_option", {});
  }

  const userOptionKeys = tutorials.map(getUserOptionKey);
  let updates = false;
  userOptionKeys.forEach((key) => {
    if (!user.get(key)) {
      user.set(key, true);
      user.set(`user_option.${key}`, true);
      updates = true;
    }
  });

  // Show next tutorial in queue
  showNextTutorial();

  return updates ? user.save(userOptionKeys) : Promise.resolve();
}

function addToQueue(options) {
  for (let i = 0; i < queue.size; ++i) {
    if (queue[i].tutorial === options.tutorial) {
      queue[i] = options;
      return;
    }
  }

  queue.push(options);
}

function showNextTutorial() {
  const options = queue.shift();
  if (options) {
    showTutorial(options);
  }
}
