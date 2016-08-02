import Ember from 'ember';
import { stubRequest } from 'ember-cli-fake-server';
import MockLocation from './mock-location';
import MockTitle from './mock-title';
import { stubValidSession } from './torii'; // provided by Torii

Ember.Test.registerHelper('createStubUser', function(app, userData) {
  userData = userData || {};
  userData.id = userData.id || 'user1';
  const defaultUserData = {
    name: 'stubbed user',
    email: 'stubbed-user@gmail.com',
    verified: true,
    _links: {
      ssh_keys: { href: `/users/${userData.id}/ssh_keys` },
      roles:  { href: `/users/${userData.id}/roles` },
      otp_configurations:  { href: `/users/${userData.id}/otp_configurations` },
      current_otp_configuration: { },  // None by default
      self: { href: `/users/${userData.id}` }
    }
  };

  return Ember.$.extend(true, defaultUserData, userData);
});

Ember.Test.registerHelper('createStubRole', function(app, roleData) {
  roleData = roleData || {};
  roleData.id = roleData.id || 'r1';
  const defaultRoleData = {
    type: 'owner',
    name: 'Account Owner',
    _links: {
      self: { href: `/roles/${roleData.id}` },
      organization: { href: '/organizations/1' }
    }
  };

  return Ember.$.extend(true, defaultRoleData, roleData);
});

Ember.Test.registerHelper('createStubToken', function(app, tokenData, stubUser) {
  tokenData = tokenData || {};
  tokenData.id = tokenData.id || 'stubbed-token-id';
  const defaultTokenData = {
    access_token: 'my-token',
    token_type: 'bearer',
    expires_in: 2,
    scope: 'manage',
    type: 'token',
    _links: {
      self: { href: `/tokens/${tokenData.id}` },
      user: { href: stubUser._links.self.href }
    }
  };

  return Ember.$.extend(true, defaultTokenData, tokenData);
});

Ember.Test.registerHelper('signIn', function(app, userData, roleData, tokenData){
  userData = createStubUser(userData);
  roleData = createStubRole(roleData);
  tokenData = createStubToken(tokenData, userData);

  stubRequest('get', `/roles/${roleData.id}`, function(){
    return this.success(roleData);
  });

  stubRequest('get', `/users/${userData.id}/roles`, function(){
    return this.success({
      _embedded: {
        roles: [roleData]
      }
    });
  });

  stubRequest('get', `/users/${userData.id}`, function() {
    return this.success(userData);
  });

  stubRequest('get', '/current_token', function() {
    return this.success(tokenData);
  });

  stubRequest('get', `/tokens/${tokenData.id}`, function() {
    return this.success(tokenData);
  });
});

Ember.Test.registerAsyncHelper('signInAndVisit', function(app, url, userData, roleData, tokenData){
  signIn(userData, roleData, tokenData);
  visit(url);
});

Ember.Test.registerHelper('expectReplacedLocation', function(app, url){
  equal(MockLocation.last(), url, `window.location replaced with "${url}"`);
});

Ember.Test.registerAsyncHelper('expectRedirectsWhenLoggedIn', function(app, url){
  stubIndexRequests();
  signInAndVisit(url);

  andThen(function(){
    equal(currentPath(), 'dashboard.catch-redirects.stack.apps.index');
  });
});

Ember.Test.registerHelper('expectTitle', function(app, title){
  equal(MockTitle.last(), title, `window.document.title updated to "${title}"`);
});

Ember.Test.registerAsyncHelper('clickNextPageLink', function(app){
  click('.pager .next a');
});

Ember.Test.registerAsyncHelper('clickPrevPageLink', function(app){
  click('.pager .previous a');
});

Ember.Test.registerHelper('expectPaginationElements', function(app, options){
  options = options || {};

  var pagination = find('.pager');
  ok(pagination.length, 'has pagination');

  // var currentPage = options.currentPage || 1;
  // var currentPageEl = find('.current:contains('+currentPage+')', pagination);
  // ok(currentPageEl.length, 'has current page: '+currentPage);

  var prevPage = find('.previous', pagination);
  if (options.prevEnabled){
    ok(prevPage.length, 'visible previous div');
  } else {
    ok(prevPage.length === 0, 'hidden previous div');
  }

  var nextPage = find('.next', pagination);
  if (options.nextDisabled){
    ok(nextPage.length === 0, 'hidden next page div');
  } else {
    ok(nextPage.length, 'visible next page div');
  }
});

Ember.Test.registerHelper('equalElementText', function(app, node, expectedText){
  equal(node.text().trim(), expectedText, "Element's text did not match expected value");
});

Ember.Test.registerHelper('elementTextContains', function(app, node, expectedText){
  var nodeText = node.text();
  ok( nodeText.indexOf(expectedText) !== -1,
      "Element's text did not match expected value, was: '"+nodeText+"'" );
});

Ember.Test.registerHelper('stubStack', function(app, stackData){
  var id = stackData.id;
  if (!id) { throw new Error('cannot stub stack without id'); }
  let defaultStackData = {
    activated: true,
    _links: {
      self: { href: '...' },
      organization: { href: '/organizations/1' }
    },
    _embedded: {
      permissions: [{
        id: `${id}-permission-1`,
        scope: 'manage',
        _links: {
          role: { href: '/roles/r1' }
        }
      }]
    }
  };
  stackData = Ember.$.extend(true, defaultStackData, stackData);

  stubRequest('get', `/accounts/${id}`, function(request){
    return this.success(stackData);
  });
});

Ember.Test.registerHelper('stubApp', function(app, appData){
  let defaultAppData = {
    id: 'app-id',
    status: 'provisioned',
    _links: { account: { href: '/accounts/stubbed-stack' } }
  };
  if (Ember.get(appData, '_links.stack')) {
    Ember.warn('App _link for stack must be called `account`');
  }
  appData = appData || {};

  // deep merge
  appData = Ember.$.extend(true, defaultAppData, appData || {});

  stubRequest('get', '/apps/:app_id', function(request){
    appData.id = request.params.app_id;
    return this.success(appData);
  });
});

Ember.Test.registerHelper('stubDatabase', function(app, databaseData){
  var id = databaseData.id;
  if (!id) { throw new Error('cannot stub database without id'); }

  stubRequest('get', '/databases/' + id, function(request){
    return this.success(databaseData);
  });
});

Ember.Test.registerHelper('stubStackDatabases', function(app, stackId, dbData){
  stubRequest('get', `/accounts/${stackId}/databases`, function(request){
    return this.success({
      _embedded: {
        databases: dbData
      }
    });
  });
});

Ember.Test.registerHelper('stubStacks', function(app, options, stacks){
  if (!options) { options = {}; }
  if (options.includeApps === undefined) {
    options.includeApps = true;
  }
  if (options.includeDatabases === undefined) {
    options.includeDatabases = true;
  }

  stacks = stacks || [{
    _links: {
      self: { href: '...' },
      apps: { href: '/accounts/my-stack-1/apps' },
      databases: { href: '/accounts/my-stack-1/databases' },
      organization: { href: '/organizations/1' }
    },
    _embedded: {},
    id: 'my-stack-1',
    handle: 'my-stack-1',
    activated: true
  }, {
    _links: {
      self: { href: '...' },
      apps: { href: '/accounts/my-stack-2/apps' },
      databases: { href: '/accounts/my-stack-2/databases' },
      organization: { href: '/organizations/1' }
    },
    _embedded: {},
    id: 'my-stack-2',
    handle: 'my-stack-2',
    activated: true
  }];

  if (options.logDrains) {
    stacks[0]._embedded.log_drains = options.logDrains;
  }

  stubRequest('get', '/accounts', function(request){
    return this.success({
      _links: {},
      _embedded: {
        accounts: stacks
      }
    });
  });

  if (options.includeDatabases) {
    stubRequest('get', '/accounts/my-stack-1/databases', function(request){
      return this.success({
        _embedded: {
          databases: [{
            id: 1,
            handle: 'my-db-1-stack-1',
            status: 'provisioned'
          }, {
            id: 2,
            handle: 'my-db-2-stack-1',
            status: 'provisioned'
          }]
        },
        _links: {
          account: { href: '/accounts/my-stack-1'}
        }
      });
    });
    stubRequest('get', '/accounts/my-stack-2/databases', function(request){
      return this.success({
        _embedded: {
          databases: [{
            id: 3,
            handle: 'my-db-1-stack-2'
          }, {
            id: 4,
            handle: 'my-db-2-stack-2'
          }]
        },
        _links: {
          account: { href: '/accounts/my-stack-1'}
        }
      });
    });
  }

  if (options.includeApps) {
    stubRequest('get', '/accounts/my-stack-1/apps', function(request){
      return this.success({
        _links: {},
        _embedded: {
          apps: [{
            id: 1,
            handle: 'my-app-1-stack-1',
            status: 'provisioned',
            _embedded: {
              services: [{
                id: '1',
                handle: 'the-service',
                container_count: 1
              }]
            },
            _links: {
              account: { href: '/accounts/my-stack-1'}
            }
          }, {
            id: 2,
            handle: 'my-app-2-stack-1',
            status: 'provisioned',
            _embedded: {
              services: [{
                id: '2',
                handle: 'the-service-2',
                container_count: 1
              }]
            },
            _links: {
              account: { href: '/accounts/my-stack-1'}
            }
          }]
        }
      });
    });
    stubRequest('get', '/accounts/my-stack-2/apps', function(request){
      return this.success({
        _links: {},
        _embedded: {
          apps: [{
            id: 3,
            handle: 'my-app-1-stack-2',
            status: 'provisioned',
            _embedded: {
              services: []
            }
          }, {
            id: 4,
            handle: 'my-app-2-stack-2',
            status: 'provisioned',
            _embedded: {
              services: []
            }
          }]
        }
      });
    });
  }
});

Ember.Test.registerHelper('expectStackHeader', function(app, stackHandle){
  var handle = find('header .account-handle:contains(' + stackHandle + ')');
  ok(handle.length, 'expected stack header with handle: ' + stackHandle);
});


Ember.Test.registerHelper('stubBillingDetail', function(app, billingDetailData){
  let defaultData = {
    _links: {
      self: { href: '/billing_details/1' },
      organization: { href: '' }
    },
   id: 1,
   paymentMethodName: 'Visa',
   paymentMethodDisplay: '4242',
   type: 'billingDetail',
   plan: 'platform'
  };

  billingDetailData = Ember.$.extend(true, defaultData, billingDetailData || {});
  stubRequest('get', '/billing_details/:org_id', function(request){
    billingDetailData.id = request.params.org_id;
    billingDetailData._links.self.href = `/billing_details/${billingDetailData.id}`;
    billingDetailData._links.organization.href = `/organizations/${billingDetailData.id}`;
    return this.success( billingDetailData );
  });
});


Ember.Test.registerHelper('stubOrganizations', function(app){
  let orgData = {
    _links: {
      self: { href: '/organizations/1' },
      billing_detail: { href: '/billing_details/1' }
    },
    id: 1,
    name: 'Sprocket Co',
    handle: 'sprocket-co',
    type: 'organization'
  };
  stubRequest('get', '/organizations', function(request){
    return this.success({
      _links: {},
      _embedded: { organizations: [orgData] }
    });
  });
  stubRequest('get', '/organizations/:org_id', function(request){
    return this.success(orgData);
  });
  stubBillingDetail({
    id: orgData.id,
    _links: { self: `/billing_details/${orgData.id}` }
  });
});

Ember.Test.registerHelper('stubOrganization', function(app, orgData, billingDetailData){
  let defaultData = {
    _links: {
      self: { href: '/organizations/1' },
      billing_detail: { href: '' },
    },
    id: 1, name: 'Sprocket Co', handle:'sprocket-co', type: 'organization'
  };
  orgData = Ember.$.extend(true, defaultData, orgData || {});
  stubRequest('get', '/organizations/:org_id', function(request){
    orgData.id = request.params.org_id;
    orgData._links.self.href = `/organizations/${orgData.id}`;
    orgData._links.billing_detail.href = `/billing_details/${orgData.id}`;
    return this.success( orgData );
  });

  let defaultBillingDetail = {
    id: orgData.id,
    _links: { self: `/billing_details/${orgData.id}` }
  };
  billingDetailData = Ember.$.extend(true, defaultBillingDetail, billingDetailData || {});
  stubBillingDetail(billingDetailData);
});

Ember.Test.registerHelper('expectLink', function(app, link, options) {
  let contextEl = (options || {}).context;
  let selector = `*[href*="${link}"]`;
  let linkEl;
  if (contextEl) {
    linkEl = contextEl.find(selector);
  } else {
    linkEl = find(selector);
  }

  if (linkEl.length) {
    ok(true, `Found link "${link}"`);
    return linkEl;
  } else {
    ok(false, `Did not find link "${link}"`);
  }
});

Ember.Test.registerHelper('expectNoLink', function(app, link, options) {
  let contextEl = (options || {}).context;
  let selector = `*[href*="${link}"]`;
  let linkEl;
  if (contextEl) {
    linkEl = contextEl.find(selector);
  } else {
    linkEl = find(selector);
  }

  if (linkEl.length) {
    ok(false, `Expected not to find link "${link}"`);
  } else {
    ok(true, `Did not find link "${link}"`);
  }
});

Ember.Test.registerHelper('findButton', function(app, buttonName, options) {
  let context = (options || {}).context;

  // find 'button' or '.btn' containing name
  let buttonSelector = `button:contains(${buttonName})`;
  let btnSelector = `.btn:contains(${buttonName})`;
  let aSelector = `a:contains(${buttonName})`;

  let selector = `${buttonSelector}, ${btnSelector}, ${aSelector}`;
  let el = context ? context.find(selector) : find(selector);

  return el;
});

Ember.Test.registerAsyncHelper('check', function(app, name) {
  let checkbox = findInput(name);
  checkbox.prop('checked', true);
  checkbox.change();
});

Ember.Test.registerAsyncHelper('clickButton', function(app, buttonName, options) {
  let button = findButton(buttonName, options);
  if (!button.length){
    throw new Error('Cannot find button with name: ' + buttonName);
  }
  click(button);
});

Ember.Test.registerHelper('expectButton', function(app, buttonName, options) {
  let el = findButton(buttonName, options);
  if (el.length) {
    ok(true, `Found ${el.length} of button "${buttonName}"`);
  } else {
    ok(false, `Found 0 of button "${buttonName}"`);
  }
});

Ember.Test.registerHelper('expectNoButton', function(app, buttonName, options) {
  let el = findButton(buttonName, options);
  if (el.length) {
    ok(false, `Expected 0 but found ${el.length} of button "${buttonName}"`);
  } else {
    ok(true, `Expected and found 0 of button "${buttonName}"`);
  }
});

Ember.Test.registerHelper('findInput', function(app, inputName, options) {
  options = options || {};
  let context = options.context;
  let inputType = options.input || 'input';

  let inputSel = `input[name="${inputName}"]`;
  let textareaSel = `textarea[name="${inputName}"]`;
  let selectSel = `select[name="${inputName}"]`;
  let selector = `${inputSel}, ${textareaSel}, ${selectSel}`;
  let el = context ? context.find(selector) : find(selector);

  return el;
});

Ember.Test.registerHelper('expectInput', function(app, inputName, options) {
  let el = findInput(inputName, options);
  if (el.length) {
    if (options && options.value) {
      equal(el.val(), options.value, `Found input "${inputName}" with value "${options.value}"`);
    } else {
      ok(true, `Found ${el.length} of input "${inputName}"`);
    }
  } else {
    ok(false, `Found 0 of input "${inputName}"`);
  }
});

Ember.Test.registerHelper('expectNoInput', function(app, inputName, options) {
  let el = findInput(inputName, options);
  if (el.length) {
    ok(false, `Expected 0 but found ${el.length} of input "${inputName}"`);
  } else {
    ok(true, `Found 0 of input "${inputName}"`);
  }
});

Ember.Test.registerAsyncHelper('expectFocusedInput', function(app, inputName, options) {
  // run.later gives DOM a chance to catch up, so that `autofocus` takes effect, e.g.
  return Ember.run.later(null, () => {
    let input = findInput(inputName, options);
    if (!input.length) {
      ok(false, `Found ${input.length} of input "${inputName}"`);
    } else {
      let el = input.get(0);
      if (document.activeElement === el) {
        ok(true, `Found focused input "${inputName}"`);
      } else {
        ok(false, `Expect input "${inputName}" to be focused`);
      }
    }
  }, 0);
});

Ember.Test.registerAsyncHelper('fillInput', function(app, inputName, value, inputOptions){
  let input = findInput(inputName, inputOptions);
  if (!input.length) {
    throw new Error(`Failed to find input: "${inputName}"`);
  }
  fillIn(input, value);
});

Ember.Test.registerHelper('stubDatabases', function(app, dbData){
  stubRequest('get', '/databases', function(request){
    return this.success({
      _embedded: {
        databases: dbData
      }
    });
  });
});

Ember.Test.registerHelper('stubUser', function(app, userData={}){
  stubRequest('get', '/users/:user_id', function(request){
    userData.id = request.params.user_id;
    return this.success(userData);
  });
});

Ember.Test.registerAsyncHelper('triggerSlider', function(app, selector, argument){
  let slider = findWithAssert(selector);
  Ember.run.later(() => {
    slider.trigger('slide', argument);
    slider.trigger('set', argument);
  });
});

Ember.Test.registerHelper('stubInvitation', function(app, invitationData={}){
  const defaultData = {
    id: 'invite-1',
    organization_name: 'the org'
  };

  invitationData = Ember.$.extend(true, defaultData, invitationData);
  stubRequest('get', `/invitations/${invitationData.id}`, function(request){
    return this.success(invitationData);
  });
});

// stubs the requests necessary to load the index route
// for a logged-in user.
// Note that this will redirect to stack.apps.index
Ember.Test.registerHelper('stubIndexRequests', function(app){
  stubStacks();
  stubOrganization();
  stubOrganizations();
});
