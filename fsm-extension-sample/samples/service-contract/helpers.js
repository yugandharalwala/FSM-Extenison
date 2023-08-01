// 
// Update html dom with provided string value
//
const updateUI = (text) =>
  (document.querySelectorAll('#info')[0].innerText = text);

//
// Loop before a token expire to fetch a new one
//
function initializeRefreshTokenStrategy(shellSdk, auth) {

  shellSdk.on(SHELL_EVENTS.Version1.REQUIRE_AUTHENTICATION, (event) => {
    sessionStorage.setItem('token', event.access_token);
    setTimeout(() => fetchToken(), (event.expires_in * 1000) - 5000);
  });

  function fetchToken() {
    shellSdk.emit(SHELL_EVENTS.Version1.REQUIRE_AUTHENTICATION, {
      response_type: 'token'  // request a user token within the context
    });
  }

  sessionStorage.setItem('token', auth.access_token);
  setTimeout(() => fetchToken(), (auth.expires_in * 1000) - 5000);
}

// 
// Request context with activity ID to return serviceContract assigned
//
function getServiceContract(cloudHost, account, company, activity_id) {
  
  const headers = {
    'Content-Type': 'application/json',
    'X-Client-ID': 'fsm-extension-sample',
    'X-Client-Version': '1.0.0',
    'Authorization': `bearer ${sessionStorage.getItem('token')}`,
  };

  return new Promise(resolve => {

    // Fetch Activity object
    fetch(`https://${cloudHost}/api/data/v4/Activity/${activity_id}?dtos=Activity.37&account=${account}&company=${company}`, {
      headers
      })
        .then(response => response.json())
        .then(function(json) {

          const activity = json.data[0].activity;
          // Fetch all ServiceContractEquipment
          fetch(`https://${cloudHost}/api/data/v4/ServiceContractEquipment?dtos=ServiceContractEquipment.12&account=${account}&company=${company}`, {
            headers
            })
              .then(response => response.json())
              .then(function(json) {

                const serviceContractEquipment = json.data.find(contract => contract.serviceContractEquipment.equipment === activity.equipment);
                if (!serviceContractEquipment) {
                  resolve(null);
                } else {
                  fetch(`https://${cloudHost}/api/data/v4/ServiceContract/${serviceContractEquipment.serviceContractEquipment.serviceContract}?dtos=ServiceContract.13&account=${account}&company=${company}`, {
                    headers
                    })
                      .then(response => response.json())
                      .then(function(json) {
                        resolve(json.data[0].serviceContract);
                      });
                }

              });

        });


  });
}

function getBestMatchTech(cloudHost, account, company, activity_id) {
console.log("our custom code::::")
           const headers = {
             'Content-Type': 'application/json',
             'X-Client-ID': 'fsm-extension-sample',
             'X-Client-Version': '1.0.0',
             'Authorization': `bearer ${sessionStorage.getItem('token')}`,
           };

     return new Promise(resolve => {
           fetch('https://us.coresystems.net/workforce-management/portal/bestmatch/v2/best-match', {
              method: 'post',
              headers: headers,
              body: {
                      "objectId": "7B7F30B0C8A34C468B4F4072894DA122",
                      "objectType": "ACTIVITY",
                      "optimizationPlugin": "Distance",
                      "resources": {
                        "includeInternalPersons": true,
                        "includeCrowdPersons": false,
                        "personIds": [
                          "9316FA5BE4AE4550AFE6CD43410B1605",
                          "AC6D378171C86E63A56DB785CE354349",
                          "536DBD8822474E6987740173D1D938D1",
                          "1763EF3AA59CBEC717FB65543182E8B2",
                          "E671EDB8F140433A9A8E045C2D2B7F09",
                          "739C09FCC85A49A993EE172B7A2DAEEE",
                          "B6224F0411274B68B0A3B71203E1BB82",
                          "14523B3D57424338858CB56BBF120696",
                          "ACD6DB5B91A26A57A8074ABBDB120AAB",
                          "8A084D5C7974462E96463FB934B3B43B",
                          "6334C731996E4021B4567A823B666DA6",
                          "373FBBFC450B43A5B6187783B2F7370C",
                          "CA971D25D8194C4983EE1183E01ADF48",
                          "BED2CB83339F48EBA0DE0B2800193C89",
                          "6C29181DBE8040BB94A4C71ED2081ACA",
                          "574AC6655E244387820566B429C320CF",
                          "CE41A9716522031F964AC4F9505D89F8",
                          "16123F041CFB45D8A75864B16BD62EF7",
                          "2000DFD28A9645A5878C4D9EB55385F8",
                          "2BC9E740CF0D4194920D8515B7D37DB8",
                          "832EBE4870F54FB2A2C4F1163A133902",
                          "567A5050946E4C1A9B6FA742C8D33018",
                          "C7F8D4BCAD124F169B0C52AA35EE8F1B",
                          "4C8CD88DA7604CE9AFFFE7057F47B07A",
                          "6AA45E57C181444F92DBE15A1A0FDF6B",
                          "2AF6D1CAFFE71BD679935168331449AA",
                          "2C54954EC63E01C9EE7BEBF007FAB8AC",
                          "8B9965CF8EC0463585E540A59BC2F54B",
                          "6C434FF154754CFC8156B1EAE8E38BAA"
                        ]
                      },
                      "schedulingOptions": {
                        "spanJobs": false,
                        "computeDrivingTime": true,
                        "timezoneId": "Asia/Calcutta",
                        "overlapBookings": false,
                        "maxResults": 10,
                        "defaultDrivingTimeMinutes": 0
                      },
                      "additionalDataOptions": {
                        "useBlacklist": false,
                        "enableRealTimeLocation": true,
                        "realTimeLocationThresholdInMinutes": 60,
                        "includePlannedJobsAsBookings": false
                      }
                    }
             }).then(response => console.log(response.json()));
        });
        }
