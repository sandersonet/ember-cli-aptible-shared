import Ember from "ember";
import storage from '../utils/storage';
import config from "../config/environment";
import JWT from '../utils/jwt';
import ajax from "../utils/ajax";
import { auth } from '../adapters/application';

function clearSession(){
  delete auth.token;
}

function persistSession(accessToken){
  auth.token = accessToken;
}

function pushTokenToStore(tokenPayload, store) {
  return store.push('token', {
    id: tokenPayload.id,
    accessToken: tokenPayload.access_token,
    links: {
      user: tokenPayload._links.user.href
    }
  });
}

export default Ember.Object.extend({
  analytics: Ember.inject.service(),
  _authenticateWithPayload(tokenPayload) {
    var store = this.store;
    return new Ember.RSVP.Promise(function(resolve){
      persistSession(tokenPayload.access_token);
      resolve(pushTokenToStore(tokenPayload, store));
    }).then((token) => {
      return Ember.RSVP.hash({
        token,
        currentUser: token.get('user')
      });
    }).then((session) => {
      this.identifyToAnalytics(session.currentUser);
      return session;
    }).catch(function(e){
      clearSession();
      throw e;
    });
  },

  fetch() {
    return ajax(config.authBaseUri+'/current_token', {
      type: 'GET',
      xhrFields: { withCredentials: true }
    }).then((tokenPayload) => {
      return this._authenticateWithPayload(tokenPayload);
    }).catch(function(jqXHR){
      if (jqXHR.responseJSON) {
        throw new Error(jqXHR.responseJSON.message);
      } else if (jqXHR.responseText) {
        throw new Error(jqXHR.responseText);
      } else {
        throw new Error("Unknown error from the server.");
      }
    });
  },

  open(tokenPayload) {
    return this._authenticateWithPayload(tokenPayload);
  },

  close(token) {
    Ember.assert(
      `A token must be passed: session.close('aptible', /*token*/);`,
      !!token
    );
    return ajax(config.authBaseUri+`/tokens/${token.get('id')}`, {
      type: 'DELETE',
      headers: {
        'Authorization': 'Bearer ' + auth.token
      },
      xhrFields: { withCredentials: true }
    }).then(() => {
      clearSession();
    });
  },

  identifyToAnalytics(user) {
    const email = user.get('email');
    this.get('analytics').identify(user.get('id'), {
      email: email,
      id: user.get('id'),
      name: user.get('name'),
      createdAt: user.get('createdAt')
    });
  }

});
