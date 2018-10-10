// input getters
let getters = {
  'int':  function ($elm){
      return parseInt($elm.value,10);
    },
   'float':  function ($elm){
      return parseFloat($elm.value);
    },
    'bool': function ($elm){
      return $elm.checked;
    }
}
let setters = {
  'int':  function ($elm, value){
      $elm.value = value;
    },
   'float':  function ($elm, value){
      $elm.value = value;
    },
    'bool': function ($elm, checked){
      $elm.checked = checked;
    }
}

// input validators
function ensure_range(min=null, max=null) {
  return function($elm, getter, setter) {
    let value = getter($elm);
    value = clamp(value, min, max);
    setter($elm, value);
  }
}
function ensure_fixnum(places) {
  return function($elm, getter, setter) {
    let value = getter($elm);
    value = fixnum(value, places);
    setter($elm, value);
  }
}

function fixnum(value, places) {
  let shift = Math.pow(10,places);
  return Math.round(value * shift) / shift;
}
function clamp(value, min=null, max=null) {
  if(min !== null) {
    value = Math.max(min, value);
  }
  if(max !== null) {
    value = Math.min(max, value);
  }
  return value;
}

// some feedbacks
function feedback_verbose_days(receiver_id) {
  return function(d) {
    let $receiver = document.getElementById(receiver_id);
    $receiver.textContent = days_to_verbose(d);
  }
}
function feedback_percent(receiver_id, places=0) {
  return function(number) {
    let $receiver = document.getElementById(receiver_id);
    $receiver.textContent = to_percent(number, places);
  }
}

function days_to_verbose(d) {
  const DAYS_IN_YEAR = 365;
  const MONTHS = [31,28,31,30,31,30,31,31,30,31,30,31]
  years = Math.floor(d/DAYS_IN_YEAR);
  let days = d - Math.floor(years * DAYS_IN_YEAR);
  let months = 0;
  for (let i = 0; i < MONTHS.length && days > MONTHS[i]; i++){
      months++;
      days -= MONTHS[i];
  }  
  let display= (value, unit, units) => value > 0 ? `${value} ${(value === 1) ? unit : units}` : '';
  return [`${display(years,'year','years')}`,
          `${display(months,'month','months')}`,
          `${display(days,'day','days')}`].filter(e => e !== '').join(', ')
}
function to_percent(number, places=0) {
  return fixnum(number * 100, places) + "%";
}

// slightly ugly but practical
function process_inputs(holder=window){  
  for(let id in inputs) {
    let getter = getters[inputs[id].type];
    let setter = setters[inputs[id].type];
    let validators = inputs[id].validators;
    let feedback =  inputs[id].feedback;
    let notify =  inputs[id].notify;
    let $elm = document.getElementById(id);
    if($elm.onchange === null) {
      $elm.onchange = function() {
        let value = null;
        for(let validator of validators) {
          validator(this, getter, setter);
        }
        if(feedback) {
          feedback(getter(this));
        }
        if(notify) {
          for(let _id of notify) {
            let $to_notify = document.getElementById(_id);
            if ($to_notify.onchange) $to_notify.onchange();
          }         
        }
      };
    }
    $elm.onchange();
    // yeah globals \o/
    holder[id] = getter($elm);
  }
}
