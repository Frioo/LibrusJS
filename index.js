//
//  Librus NodeJS client
//  by Adam Żbikowski
//  15.09.2018
//



// Node-Fetch is a Fetch implementation for NodeJS
// Might be replaced with 'Ky' in the future
// https://github.com/sindresorhus/ky
const nodeFetch = require('node-fetch');
// Fetch-Cookie wraps around Node-Fetch and allows for cookie storage (required throughout the authorization process)
const fetch = require('fetch-cookie/node-fetch')(nodeFetch);
// Readline-sync becuase the built-in readline is weird, this module allows for normal input without hassle
const readline = require('readline-sync');
// Import project's package.json for version numbers etc.
const package_json = require('./package.json');
// JSDOM for web scraping, basically. It's currently only being used for extracting the CSRF token.
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
// Minimist for argument parsing. This line automatically parses supplied options.
var args = require('minimist')(process.argv.slice(2));
// Utils file with helper functions
const utils = require('./utils.js');

// Application-wide variables
let account;
let librus_access_token;
const client_id = 'wmSyUMo8llDAs4y9tJVYY92oyZ6h4lAt7KCuy0Gv';
const code_url = `https://portal.librus.pl/oauth2/authorize?client_id=${client_id}&redirect_uri=http://localhost/bar&response_type=code`;
const login_url = 'https://portal.librus.pl/rodzina/login/action';
const code_exchange_url = 'https://portal.librus.pl/oauth2/access_token';
const token_exchange_url = 'https://portal.librus.pl/api/SynergiaAccounts';
const api_url = 'https://api.librus.pl/2.0/';

 
// Application entry-point
async function main() {
    console.log(`Librus ${package_json.version}`);
    if(args.username != undefined && args.password != undefined) {
        await login(args.username, args.password);
    } else {
        var email = readline.question('Email: ');
        var password = readline.question('Haslo: ', {
            hideEchoBack: true
        });

        await login(email, password)
    }
}

class SynergiaAccount {
    
    constructor(id, group, accessToken, login, fullName) {
        this.id = id;
        this.group = group;
        this.access_token = accessToken;
        this.login = login;
        this.full_name = fullName;
    }
}

async function getLessons(account) {
    console.log("> pobieranie danych lekcji");
    await fetch(`${api_url}Lessons`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${account.access_token}`
        }
    }).catch(err => console.error(err)).then(res => {
        return res.text();
    }).then(body => {
        
    })
}

async function getTimetable(account) {
    console.log("> pobieranie planu lekcji");
    await fetch(`${api_url}Timetables?weekStart=${utils.getWeekStart()}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${account.access_token}`
        }
    }).catch(err => console.error(err)).then(res => {
        return res.text();
    }).then(body => {
        console.log(body);
        var timetable = JSON.parse(body).Timetable;
        for(var i = 0; i < timetable.length; i++) {
            var schoolDay = timetable[i];
        }
    });
}

async function getRoot(account) {
    console.log("> pobieranie listy endpointow API");
    await fetch(`${api_url}Root`, {
        headers: {
            'Authorization': `Bearer ${account.access_token}`
        }
    })
        .catch(err => console.error(err))
        .then(res => {
            return res.text();
        })
        .then(body => {
            //console.log(body);
        })
}

// This function is responsible for authorizing the user
async function login(email, password) {
    var csrf_token, code;

    // Get CSRF from HTML
    console.log('> pobieranie kodu csrf');
    await fetch(code_url)
        .catch(err => console.error(err))
        .then(res => {
            return res.text();
        })
        .then(body => {
            // Scrape CSRF token from HTML meta tag
            var document = new JSDOM(body);
            csrf_token = document.window.document.querySelector("meta[name='csrf-token']").getAttribute('content');
            if (csrf_token === null) {
                console.error('> nie znaleziono kodu csrf');
            } else {
                //console.log(`> odnaleziony kod csrf: ${csrf_token}`);
            }
        });

    // Prepare JSON payload
    console.log('> wysylanie danych logowania');
    var payload = {
        "email": email,
        "password": password
    };

    // Authorize by POSTing credentials
    await fetch(login_url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 
            "X-CSRF-TOKEN": csrf_token,
            "Content-Type": "application/json"
        }
    }).then(res => {
        if(res.status != '200') {
            console.error(`> problem z logowaniem: ${res.status} ${res.statusText}\n> Sprawdz czy wpisane dane sa poprawne i sprobuj ponownie`);
            return;
        }
        console.log(`> ${res.status} ${res.statusText}`)
    });

    // Get auth code by re-visiting the code URL
    // It will now redirect to localhost with auth code supplied as a parameter.
    console.log('> uzyskiwanie kodu autoryzacji')
    await fetch(code_url, {
        // Do not allow redirects
        redirect: 'manual'
    }).then(res => {
        // Get redirect header value and save the authorization code
        code = res.headers.get('location').split('code=')[1];
        //console.log(`> uzyskany kod autoryzacji: ${code}`);
    });

    // Prepare JSON payload
    var data = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id,
        "redirect_uri": "http://localhost/bar"
    };

    // Exchange auth code for Librus account token
    console.log('> wymiana kodu autoryzacji na token konta Librus');
    await fetch(code_exchange_url, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            "Content-Type": "application/json"
        }
    }).then(res => {
        if(res.status != '200') {
            console.log(`> wymiana zakonczona niepowodzeniem: ${res.status} ${res.statusText}`);
        }
        return res.json();
    }).then(json => {
        librus_access_token = json['access_token'];
        //console.log(`> otrzymany token konta Librus: ${librus_access_token}`);
    });

    // Get list of Synergia accounts tied to provided Librus account
    console.log('> pobieranie listy kont Synergia');
    await fetch(token_exchange_url, {
        headers: {
            "Authorization": `Bearer ${librus_access_token}`
        }
    }).then(res => {
        if (res.status != '200') {
            console.error(`> pobieranie zakonczone niepowodzeniem: ${res.status} ${res.statusText}`);
            return;
        } else {
            return res.text();
        }
    }).then(body => {
        // Do not attempt to process the data if it's null (error case)
        if(body === undefined) return;

        // Parse each account object as new instance of account
        var data = JSON.parse(body);
        var res = [];
        for(var i = 0; i < data['accounts'].length; i++) {
            var account_object = data['accounts'][i];
            var account = new SynergiaAccount(
                id = account_object['id'],
                group = account_object['group'],
                access_token = account_object['accessToken'],
                login = account_object['login'],
                full_name = account_object['studentName']
            );
            res.push(account);
        }
        return res;
    }).then(accounts => {
        if(args.auto != undefined) {
            console.log('> automatyczne wybieranie konta...');
            console.log(`> wybrano ${accounts[0].login}`);
            account = accounts[0];
        } else {
            // Present all detected accounts to the user and let them save selected ones
            console.log('\n\n\nPonizej znajduje sie lista wykrytych kont Synergia.');
            console.log('Aby wybrac konto wpisz jego login i zatwierdz wciskajac [enter].');
            for(var i = 0; i < accounts.length; i++) {
                console.log(`> ${accounts[i].full_name} (${accounts[i].group}) | ${accounts[i].login}`);
            }
            var selection = readline.question('Wybor: ');
            for(var i = 0; i < accounts.length; i++) {
                if(accounts[i].login === selection) {
                    account = accounts[i];
                    console.log(`Wybrano konto ${account.login}`);
                }
            }
        }
    });

    await getRoot(account);
    await getTimetable(account);
}

// Start app from entry-point
main();