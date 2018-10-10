{
  let $log = document.getElementById('log');
  window.clear = function() {
    $log.textContent = '';
  }

  window.log = function(...msg) {
		$log.textContent += msg.join(' ') + '\n'; 
  }
}
let $run = document.getElementById('run');
$run.onclick = function() {
	run();
};
function run_button_disabled(state){
	$run.disabled = state;
}
let $output = document.getElementById('output');


// inputs

const DECIMAL_PLACES = 2;
function feedback_sec_to_per_min(receiver_id) {
	return function(sec) {
  	let $receiver = document.getElementById(receiver_id);
    $receiver.textContent = `${fixnum(60/sec,2)} reps/min` ;
  }
}
function feedback_reps_for_study_time(receiver_id, aat_id) {
	return function(study_time){
  	let $receiver = document.getElementById(receiver_id);
    let $aat = document.getElementById(aat_id);
    let aat = getters[inputs[aat_id].type]($aat);
    let reps = Math.floor(study_time*60/aat);
    $receiver.textContent = `${reps} reps/day` ;  
  }
}

let inputs = {
  desired_deck_duration:{type:"int",validators:[ensure_range(0)], feedback:feedback_verbose_days('ddd_fb')}, 
  desired_study_time   :{type:"int",validators:[ensure_range(0)], feedback:feedback_reps_for_study_time('dst_fb','average_answer_time')},
  average_answer_time  :{type:"float",validators:[ensure_range(0)], feedback:feedback_sec_to_per_min('aat_fb'), notify:['desired_study_time']},
  current_retention    :{type:"float",validators:[ensure_range(0.01, 1),ensure_fixnum(2)], feedback:feedback_percent('cr_fb')},
  current_im           :{type:"float",validators:[ensure_range(0.01)], feedback:feedback_percent('cim_fb')},
  failure_penalty      :{type:"float",validators:[ensure_range(0, 1)], feedback:feedback_percent('fp_fb')},
  use_anki_fail_factor :{type:"bool",validators:[]},
  reps_new             :{type:"float",validators:[ensure_range(1)]},
  reps_failed          :{type:"float",validators:[ensure_range(1)]},
  start_retention      :{type:"float",validators:[ensure_range(0.01,0.99),ensure_fixnum(DECIMAL_PLACES)], feedback:feedback_percent('sr_fb')},
  end_retention        :{type:"float",validators:[ensure_range(0.01,0.99),ensure_fixnum(DECIMAL_PLACES)], feedback:feedback_percent('er_fb')},
  steps                :{type:"float",validators:[ensure_range(0.01),ensure_fixnum(DECIMAL_PLACES)], feedback:feedback_percent('s_fb')}
};
process_inputs(window.simulation_parameters);

function get_reps_day(retention, interval_modifier, new_cards_day) {
  let deck_size = window.simulation_parameters.desired_deck_duration * new_cards_day;
  let deck = window.simulate(deck_size, retention, interval_modifier, new_cards_day);
    // return mean reps day for second half
  let sum = 0;
  let total = 0;
  for(let i = Math.floor(deck.log.length/2); i<deck.log.length; i++) {
    sum += deck.log[i].reps;
    total++;
  }
  return sum/total;
}
function true_retention(anki_retention) {
	return -(1-anki_retention)/Math.log(anki_retention);
}
function percent_increase(value, base) {
  return (value - base) / base;
}

function *iterate(current, start, end, step) {
  let diff = end - start;
	let delta = Math.abs(diff);
  let dir = Math.sign(diff);
  let where_current = null;
	if (current*dir < start*dir) {
  	yield current;
  }     
  let last_retention = start;
  for (let i = 0; i <= Math.ceil(delta/step) && last_retention !== end; i++){
  	let retention = start + i*step * dir;
    retention = fixnum(retention, DECIMAL_PLACES);
    if (current*dir > last_retention*dir && current*dir < retention*dir) {
    	yield(current);
    }
    yield fixnum(retention, DECIMAL_PLACES);
    last_retention = retention;
  }  
	if (current*dir > end*dir) {
  	yield current;
  }   
}

function retention_at_100_im(current_im, current_ret) {
  return Math.exp(Math.log(current_ret)/current_im);
}

function find_new_cards_day(retention, im, expected_reps_day) {
  // do a binary search to find average reps per day
  // that surrounds total_reps_per_day
	let low = {
  	new_cards_day:1,
    reps_day:null
  };
  let high = {
  	new_cards_day:200, // may make sense to set that to expected_reps_day
    reps_day:null
  }
  
  do {
    let mid = Math.floor((low.new_cards_day + high.new_cards_day)/2);
  	let reps_day = get_reps_day(retention, im, mid);
    if (reps_day > expected_reps_day) {
    	high.new_cards_day = mid;
    	high.reps_day = reps_day;
    } else if (reps_day < expected_reps_day) {
    	low.new_cards_day = mid;
    	low.reps_day = reps_day;
    } else if (reps_day === expected_reps_day) {
    	low.new_cards_day = mid;
    	low.reps_day = reps_day;
      high.new_cards_day = mid+1;
      high.reps_day = reps_day+1;// doesn't really matter
    }
    
  }while(Math.abs(high.new_cards_day-low.new_cards_day) > 1);
  
  // do a linear approximation to find the exact corresponding new cards/day
     
  return {
  	low:low,
    high:high,
    interp: low.new_cards_day + 
         (expected_reps_day - low.reps_day)/
         (high.reps_day - low.reps_day)
  };
  
}

class Stats {
	constructor(retention, im, data) {
  	this.retention = retention;
  	this.im = im;
    this.new_cards_day = data.interp;
    this.low = data.low;
    this.high = data.high;
    this.true_retention = true_retention(this.retention);
    this.retained_new_cards = this.true_retention * this.new_cards_day;
    this.increase = null;
    this.class = new Set();
    if(this.retention === window.simulation_parameters.current_retention) {
    	this.class.add('current');
    }
  }
  toString() {
  	return [ `R: ${this.retention}`,
             `TR: ${fixnum(true_retention(this.retention),2)}`,
             `NC: ${fixnum(this.new_cards_day,2)}`].join('\t');
  }
}

function output_clear() {
	$output.innerHTML = "";
}
function output_header() {
  $output.innerHTML += `
<tr>
	<th>Retention</th>
	<th>IM</th>
	<th>True Retention</th>
	<!--<th>Low</th>
	    <th>High</th>-->
	<th>Optimal New Cards per Day</th>
	<th>Retained New Cards</th>
	<th>Increase Learning</th>
</tr>  
  `;
}
function output_row(stat){
	let tr = true_retention(stat.retention);
  if (!$output.innerHTML) output_header();
  
  let increase = (stat.increase !== null) ? to_percent(stat.increase,2) : '???';
 	let cls=[...stat.class].join(' ');
  
  
	$output.innerHTML += `
<tr class="${cls}">
	<td>${to_percent(stat.retention)}</td>
	<td>${to_percent(stat.im)}</td>
	<td>${to_percent(stat.true_retention)}</td>
  <!--
	<td>
  	nc: ${stat.low.new_cards_day}<br>
    reps: ${stat.low.reps_day}<br>
    deck size: ${window.simulation_parameters.desired_deck_duration * stat.low.new_cards_day}
  </td>
	<td>
  	nc: ${stat.high.new_cards_day}<br>
    reps: ${stat.high.reps_day}<br>
    deck_size: ${window.simulation_parameters.desired_deck_duration * stat.high.new_cards_day}
  </td>-->
	<td>${fixnum(stat.new_cards_day,0)}</td>
	<td>${fixnum(stat.retained_new_cards,2)}</td>
	<td>${increase}</td>
</tr>
  `;
}

function chain_link(arg, func) {
  return function(acc) {
    return new Promise(function(resolve) {
        setTimeout(function(){
          acc.push(func(arg));
          resolve(acc);
      },100)
    });
  }
}
function run() {
	run_button_disabled(true);
	output_clear();
	process_inputs();
	// for retention from 99% to 1%
  let base_retention = retention_at_100_im(current_im, current_retention);
  let total_reps_per_day = Math.floor(desired_study_time*60 / average_answer_time); // makes sense to floor it
  
  let result = [];
  var chain = Promise.resolve(result);
  
  
  let current_stat = new Stats(current_retention, 
  														current_im,
                              find_new_cards_day(current_retention, current_im, total_reps_per_day));
  current_stat.increase = 0;
  
  for (let retention of iterate(current_retention, start_retention, end_retention, steps)) {
	// todo -> make sure the simulation is ran with curren retention
    // maybe we can mark current retention in here...
		let im = Math.log(retention)/Math.log(base_retention);
    

 		chain = chain.then(chain_link(
    	{retention:retention, im:im, total_reps_per_day:total_reps_per_day},
      (p)=>{
      	let s = null;
      	if (p.retention === current_retention) {
        	s = current_stat
        } else {
      		s = new Stats(p.retention,p.im,find_new_cards_day(p.retention, p.im, p.total_reps_per_day))
      		s.increase = percent_increase(s.retained_new_cards,current_stat.retained_new_cards);
        }
        output_row(s);
        return s;
      }
    ));
  }
  
	// end of chain: 
  chain.then((acc) => analyze(acc))
       .then(()=>run_button_disabled(false));
}
function analyze(stats) {

  let current_stat = stats.find((s) => s.retention == window.current_retention);
 
  let best_stat = null;
  for (let s of stats) {
 		if (best_stat == null || best_stat.retained_new_cards < s.retained_new_cards) {
    	best_stat = s;
    }
	}
  current_stat.class.add('current');
  best_stat.class.add('best');
  
  redraw_table(stats)
}
function redraw_table(stats) {
	output_clear();
  for(let stat of stats) {
		output_row(stat);  
  }
  
}