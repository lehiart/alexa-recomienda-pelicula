/* eslint-disable  func-names */
/* eslint-disable  no-console */
const alexa = require('ask-sdk');
const  sprintf = require('i18next-sprintf-postprocessor');
const i18n = require('i18next');
const languageString = require('./constants');

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  async handle(handlerInput) {
    const attributes = handlerInput.attributesManager.getRequestAttributes();

    // const speechText = 'bienvenido';
    const speechText = attributes.t('GAME_NAME', 'PEPE RANA');


    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard('Hola Mundo', speechText)
      .getResponse();
  },
};

const GenresSelectIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'HelloWorldIntent';
  },
  handle(handlerInput) {
    const speechText = 'Hola Mundo!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Hola Mundo', speechText)
      .getResponse();
  },
};

/* HELPERS */

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

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speechText = 'Prueba diciendo hola!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .reprompt(speechText)
      .withSimpleCard('Hola mundo', speechText)
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
    const speechText = 'Adios!';

    return handlerInput.responseBuilder
      .speak(speechText)
      .withSimpleCard('Hola Mundo', speechText)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`La sesion termino por: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak('Lo siento, no puedo entenderte por favor repitelo.')
      .reprompt('Lo siento, no puedo entenderte por favor repitelo')
      .getResponse();
  },
};

const skillBuilder = alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    GenresSelectIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler,
  )
  .addRequestInterceptors(LocalizationInterceptor)
  .addErrorHandlers(ErrorHandler)
  .lambda();
