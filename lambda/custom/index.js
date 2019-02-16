/* eslint-disable  func-names */
/* eslint-disable  no-console */
/* eslint-disable  no-use-before-define */
const alexa = require('ask-sdk');
const sprintf = require('i18next-sprintf-postprocessor');
const i18n = require('i18next');
const rp = require('request-promise');
const languageString = require('./constants');

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  async handle(handlerInput) {
    const attributes = handlerInput.attributesManager.getRequestAttributes();
    const speechText = attributes.t('WELCOME_MSG');
    const repromptText = attributes.t('WELCOME_MSG_REPROMPT');

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(repromptText)
      .withSimpleCard('', speechText)
      .getResponse();
  },
};

const MovieDetailsIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'GetMovieDetails';
  },
  async handle(handlerInput) {
    const attributes = handlerInput.attributesManager.getRequestAttributes();
    const filledSlots = handlerInput.requestEnvelope.request.intent.slots;
    const slotValues = getSlotValues(filledSlots);
    const lng = handlerInput.requestEnvelope.request.locale;

    // Validate year no more than current
    if (slotValues.year.resolved
      && (slotValues.year.resolved.substring(0, 4) > (new Date()).getFullYear())) {
      return handlerInput.responseBuilder
        .speak(attributes.t('YEAR_MAX_ERR'))
        .withSimpleCard(attributes.t('ERR_MSG_CARD_TITLE'), attributes.t('YEAR_MAX_ERR'))
        .getResponse();
    }
    console.log(slotValues);

    const movies = await getMoviesData(slotValues, lng);
    const speechText = await buildMovieSpeechText(attributes, movies.list);

    console.log(movies);

    // check if theres more pages of movies to reprompt for YES/NO
    if (movies.next) {
      handlerInput.attributesManager.setSessionAttributes({
        movies: movies.remaining,
        inProgress: true,
        hasNextPage: true,
      });

      return handlerInput.responseBuilder
        .speak(`${speechText} ${attributes.t('RECOMMEND_REPROMPT')}`)
        .reprompt(attributes.t('RECOMMEND_REPROMPT'))
        .withSimpleCard(attributes.t('ERR_MSG_CARD_TITLE'), speechText)
        .getResponse();
    }

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard(attributes.t('ERR_MSG_CARD_TITLE'), speechText)
      .getResponse();
  },
};

const YesIntentHandler = {
  async canHandle(handlerInput) {
    const sessionAttributes = await handlerInput.attributesManager.getSessionAttributes();
    const { request } = handlerInput.requestEnvelope;

    return sessionAttributes.inProgress && sessionAttributes.hasNextPage
    && request.type === 'IntentRequest' && request.intent.name === 'AMAZON.YesIntent';
  },
  async handle(handlerInput) {
    const attributes = handlerInput.attributesManager.getRequestAttributes();
    const sessionAttributes = await handlerInput.attributesManager.getSessionAttributes();

    const speechText = await buildMovieSpeechText(attributes, sessionAttributes.movies);

    return handlerInput.responseBuilder
      .speak(`${attributes.t('YES_INTENT_MSG')} ${speechText}`)
      .getResponse();
  },
};

const NoIntentHandler = {
  async canHandle(handlerInput) {
    const sessionAttributes = await handlerInput.attributesManager.getSessionAttributes();
    const { request } = handlerInput.requestEnvelope;

    return sessionAttributes.inProgress
    && request.type === 'IntentRequest' && request.intent.name === 'AMAZON.NoIntent';
  },
  handle(handlerInput) {
    const attributes = handlerInput.attributesManager.getRequestAttributes();

    return handlerInput.responseBuilder
      .speak(attributes.t('NO_INTENT_MSG'))
      .getResponse();
  },
};

/* HELPERS */

async function getMoviesData(slots, lng) {
  let moviesList;
  const base = 'https://api.themoviedb.org/3/discover/movie?api_key=df10967a369a0bf603093aa8ef62f306';
  let URL = `${base}&language=${lng}&sort_by=popularity.desc&include_adult=false&include_video=false&page=1&vote_count.gte=1000`;

  // old release
  if (slots.released.id && slots.released.id === '111') {
    URL += '&release_date.lte=2015';
  }
  // new release
  if (slots.released.id && slots.released.id === '222') {
    URL += '&release_date.gte=2016';
  }
  // year selected
  if (slots.year.resolved) {
    URL += `&primary_release_year=${slots.year.resolved.substring(0, 4)}`;
  }
  // genre
  if (slots.genre.id && slots.genre.id !== '99999') {
    URL += `&with_genres=${slots.genre.id}`;
  }

  console.log('urlllll', URL);

  try {
    moviesList = await rp(URL);
  } catch (err) {
    console.log(err.message);
    throw new Error(err);
  }

  moviesList = JSON.parse(moviesList);

  // return first 3 movies
  if (moviesList.results.length > 3) {
    return {
      list: parseMovieObject(moviesList.results.splice(0, 3)),
      next: true,
      page: moviesList.page,
      remaining: parseMovieObject(moviesList.results.splice(3)),
    };
  }

  return {
    list: parseMovieObject(moviesList.results),
    next: false,
    page: moviesList.page,
  };
}

function parseMovieObject(list) {
  return list.map(movie => ({
    title: movie.title,
    description: movie.overview,
    image: movie.poster_path,
  }));
}

function buildMovieSpeechText(attributes, movies) {
  let output = '';

  if (movies.length > 1) {
    movies.forEach((movie, idx) => { output += ` ${idx > 0 ? attributes.t('RECOMMEND_MSG_CONNECTOR', movie.title, movie.description) : attributes.t('RECOMMEND_MESSAGE', movie.title, movie.description)}`; });
  } else {
    output = attributes.t('RECOMMENDATION_MESSAGE', movies[0].title, movies[0].description);
  }

  return output;
}

function getSlotValues(filledSlots) {
  const slotValues = {};

  Object.keys(filledSlots).forEach((item) => {
    const { name } = filledSlots[item];

    if (filledSlots[item] && filledSlots[item].resolutions
      && filledSlots[item].resolutions.resolutionsPerAuthority[0]
      && filledSlots[item].resolutions.resolutionsPerAuthority[0].status
      && filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) {
      switch (filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) {
        case 'ER_SUCCESS_MATCH':
          slotValues[name] = {
            synonym: filledSlots[item].value,
            id: filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.id,
            resolved: filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.name,
            isValidated: true,
          };
          break;
        case 'ER_SUCCESS_NO_MATCH':
          slotValues[name] = {
            synonym: filledSlots[item].value,
            resolved: filledSlots[item].value,
            isValidated: false,
          };
          break;
        default:
          break;
      }
    } else {
      slotValues[name] = {
        synonym: filledSlots[item].value,
        resolved: filledSlots[item].value,
        isValidated: false,
      };
    }
  }, this);

  return slotValues;
}

// function initSessionAttributes(handlerInput) {
//   const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
//   // Check if user is invoking the skill the first time and initialize preset values
//   // (could be an interceptor)
//   if (Object.keys(sessionAttributes).length === 0) {
//     handlerInput.attributesManager.setSessionAttributes({
//       movies: [],
//       inProgress: false,
//       hasNextPage: false,
//     });
//   }
// }

/* INTERCEPTORS */

const LocalizationInterceptor = {
  process(handlerInput) {
    i18n.use(sprintf).init({
      fallbackLng: 'en',
      lng: handlerInput.requestEnvelope.request.locale,
      resources: languageString,
      overloadTranslationOptionHandler: sprintf.overloadTranslationOptionHandler,
    })
      .then((t) => {
        const attributes = handlerInput.attributesManager.getRequestAttributes();
        attributes.t = (...args) => t(...args);
      });
  },
};

/* BUILT-IN INTENTS */

const FallbackHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.FallbackIntent';
  },
  handle(handlerInput) {
    const attributes = handlerInput.attributesManager.getRequestAttributes();

    return handlerInput.responseBuilder
      .speak(attributes.t('FALLBACK_MESSAGE'))
      .reprompt(attributes.t('FALLBACK_REPROMPT'))
      .getResponse();
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const attributes = handlerInput.attributesManager.getRequestAttributes();
    const speechText = attributes.t('HELP_MSG');
    const cardTitle = attributes.t('HELP_MESSAGE_CARD');

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard(cardTitle, speechText)
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    const attributes = handlerInput.attributesManager.getRequestAttributes();
    const speechText = attributes.t('BYE_MSG');

    return handlerInput.responseBuilder
      .speak(speechText)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended because: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    const attributes = handlerInput.attributesManager.getRequestAttributes();
    const speechText = attributes.t('ERR_MSG');
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .getResponse();
  },
};

const skillBuilder = alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    MovieDetailsIntentHandler,
    YesIntentHandler,
    NoIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackHandler,
    SessionEndedRequestHandler,
  )
  .addRequestInterceptors(LocalizationInterceptor)
  .addErrorHandlers(ErrorHandler)
  .lambda();
