import { Initializer, Action, api, route, config, log, cache } from "actionhero";
import * as nonce from "nonce";

abstract class AuthenticationAction extends Action {
  /**
   * does this action require the user to be logged in?
   */
  skipAuthentication: boolean;
}

export class Auth extends AuthenticationAction {
  constructor() {
    super();
    this.name = "shopify:auth";
    this.description = "Check Shopify Authentication";
    this.outputExample = {
      auth: true,
      shop: "shop.myshopify.com"
    };
    this.skipAuthentication = true;
    this.params = {
      hmac: { required : true },
      shop: { required : true },
      code: { required : true },
      state: { required : true }
    }
  }

  async run({ session, actionTemplate, connection }) {
    const { apiKey, scopes, forwardingAddress } = config.shopifyAuth;

    const { hmac, shop, timestamp } = connection.params;

    if (shop) {
      const state = nonce()();
      const redirectUri = forwardingAddress + '/auth/callback';
      const installUrl = 'https://' + shop +
        '/admin/oauth/authorize?client_id=' + apiKey +
        '&scope=' + scopes +
        '&state=' + state +
        '&redirect_uri=' + redirectUri;

      log("Installing app on `" + shop + "` with scopes `" + scopes + "`;");
      connection.rawConnection.responseHeaders.push(['Location', installUrl]);
      connection.rawConnection.responseHeaders.push(['Set-cookie', "state=" + state]);
      connection.rawConnection.responseHttpCode = 302;

    } else {
      connection.rawConnection.responseHttpCode = 400;
    }
  }
}


export class AuthCallback extends AuthenticationAction {
  constructor() {
    super();
    this.name = "shopify:authCallback";
    this.description = "Check Shopify Authentication";
    this.outputExample = {
      auth: true,
      shop: "shop.myshopify.com"
    };
    this.skipAuthentication = true;
    this.params = {
      hmac: { required : true },
      shop: { required : true },
      code: { required : true },
      state: { required : true }
    }
  }

  async run({ connection, response }) {
    const { state, hmac, code, shop } = connection.params
    const stateCookie = connection.rawConnection.cookies.state;

    if (state !== stateCookie) {
      connection.rawConnection.responseHttpCode = 400;
      response.error = 'Request origin cannot be verified';
    }

    if (shop && hmac && code) {
      const { query } = connection.rawConnection.parsedURL;
      const validHmac = await api.shopifyAuth.verifyHmac(hmac, query);

      if (!validHmac) {
        connection.rawConnection.responseHttpCode = 400;
        response.error = 'HMAC validation failed';
        return;
      }

      const accessTokenResponse = await api.shopifyAuth.getAccessToken(shop, code);
      if(accessTokenResponse){
        const saveResponse = await api.shopifyAuth.createShopifySession(connection, {...accessTokenResponse, shop});
      }else{
        connection.rawConnection.responseHttpCode = 500;
        response.error = 'Error getting permanent access token from shopify';
      }
    } else {
      connection.rawConnection.responseHttpCode = 400;
      response.error = 'Required parameters missing';
    }
  }
}

export class AuthCheck extends Action {
  constructor() {
    super();
    this.name = "shopify:authCheck";
    this.description = "Check Shopify Authentication";
    authenticated: true
    this.outputExample = {
      auth: true,
      shop: "shop.myshopify.com"
    };
  }

  async run({ session, response }) {
    console.log(session);
    response.randomNumber = Math.random();
  }
}
