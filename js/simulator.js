/// UI
let $button = document.getElementById('simulate');
$button.onclick = function(){
  run();
};

function ensure_im(im_id, ra100_id, lock_id) {
	return function($elm, getter, setter) { //$elm is retention
    let $lock = document.getElementById(lock_id);
  	let $im   = document.getElementById(im_id);
    $im.disabled = false; // yeah feedback in validation code... <_<
    if(!$lock.checked) {
      let ret = getter($elm);
      
      let $ra100 = document.getElementById(ra100_id);
      let ret_at_100 = getters[inputs[ra100_id].type]($ra100);
      
      let im = Math.log(ret)/Math.log(ret_at_100);
      $im.disabled = true;
      setters[inputs[ra100_id].type]($im, im);
    }
  }
}
function feedback_desc(receiver_id) {
  return function(locked) {
    $receiver = document.getElementById(receiver_id);
    $receiver.style.display = !locked ? "inline-block" : "none";
  }
}

let inputs = {
  deck_size           :{type:"int",validators:[ensure_range(0)]}, 
  extra_sim           :{type:"int",validators:[ensure_range(0)], feedback:feedback_verbose_days('es_fb')},
  retention           :{type:"float",validators:[ensure_range(0.01, 1),ensure_fixnum(2),ensure_im('interval_modifier', 'ret_at_100_im', 'lock_chkb')], feedback:feedback_percent('r_fb')},
  new_card_per_day    :{type:"int",validators:[ensure_range(1)]},
  interval_modifier   :{type:"float",validators:[ensure_range(0.01)], feedback:feedback_percent('im_fb')},
  failure_penalty     :{type:"float",validators:[ensure_range(0, 1)], feedback:feedback_percent('fp_fb')},
  reps_new            :{type:"float",validators:[ensure_range(1)]},
  reps_failed         :{type:"float",validators:[ensure_range(1)]},
  dead_point          :{type:"int",validators:[ensure_range(0)], feedback:feedback_verbose_days('dp_fb')},
  use_anki_fail_factor:{type:"bool",validators:[]},
  ret_at_100_im       :{type:"float",validators:[ensure_range(0.01, 0.99),ensure_fixnum(2)], notify:['retention']},
  lock_chkb           :{type:"bool",validators:[], feedback:feedback_desc('im_desc'), notify:['retention']}
};
process_inputs(window.simulation_parameters);

let chart = null;
window.chartColors = {
  red: 'rgb(255, 99, 132)',
  orange: 'rgb(255, 159, 64)',
  yellow: 'rgb(255, 205, 86)',
  green: 'rgb(75, 192, 192)',
  blue: 'rgb(54, 162, 235)',
  purple: 'rgb(153, 102, 255)',
  grey: 'rgb(201, 203, 207)'
};


function run() {
	process_inputs(window.simulation_parameters);
  
  let d = window.simulate( window.simulation_parameters.deck_size, 
                           window.simulation_parameters.retention, 
                           window.simulation_parameters.interval_modifier, 
                           window.simulation_parameters.new_card_per_day)

  function get_data(deck, with_extra=false) {
  	let reps=[], reviews=[], labels=[], deads=[];    
    for(let x = 0; x<deck.log.length; x++) {
      let logentry = deck.log[x];
      if(with_extra || !logentry.extra) {
        labels.push(x+1);
        reps.push(logentry.reps);
        reviews.push(logentry.reviews);
        deads.push(logentry.dead_count)
      }
    }  	
    return {reps:reps,reviews:reviews,labels:labels,deads:deads}
  }
  function second_half(data) {
  	return {reps:data.reps.slice(data.reps.length/2),
            reviews:data.reviews.slice(data.reviews.length/2),
            labels:data.labels.slice(data.labels.length/2),
            deads:data.deads.slice(data.deads.length/2),};
  }
  
  function get_stats(data) {
    return {
      max_reps: max(data.reps),
      average_reps: Math.round(mean(data.reps)),
      median_reps: Math.round(median(data.reps)),
      average_reviews: Math.round(mean(data.reviews)),
      max_reviews: max(data.reviews),
      median_reviews: Math.round(median(data.reviews)),
      average_removed: Math.round(mean(data.deads)),
      max_removed: max(data.deads),
      median_removed: Math.round(median(data.deads)),
      total_removed: data.deads.reduce((a, b) => a + b, 0),
    }
  }
  
  let data = get_data(d)
  let s1 = get_stats(data);  
  let s2 = get_stats(second_half(data));
	
  
  let $csv = make_csv_link(d.log);

  let $output = document.getElementById('output');
  $output.innerHTML = `
<strong>Stats</strong>
<table class="stats">
	<tr><th rowspan="2"></th><th colspan="3">whole data                                                        </th><th colspan="3">second half only                                                  </th></tr>
  <tr>                     <th>reps<br>per day   </th><th>reviews<br>per day   </th><th>removed<br>per day   </th><th>reps<br>per day   </th><th>reviews<br>per day   </th><th>removed<br>per day   </th></tr>
  <tr><th>maximum     </th><td>${s1.max_reps}    </td><td>${s1.max_reviews}    </td><td>${s1.max_removed}    </td><td>${s2.max_reps}    </td><td>${s2.max_reviews}    </td><td>${s2.max_removed}    </td></tr>
  <tr><th>average     </th><td>${s1.average_reps}</td><td>${s1.average_reviews}</td><td>${s1.average_removed}</td><td>${s2.average_reps}</td><td>${s2.average_reviews}</td><td>${s2.average_removed}</td></tr>
  <tr><th>median      </th><td>${s1.median_reps} </td><td>${s1.median_reviews} </td><td>${s1.median_removed} </td><td>${s2.median_reps} </td><td>${s2.median_reviews} </td><td>${s2.median_removed} </td></tr>
</table>
<div>Cards removed at the end of the simulation: ${s1.total_removed}</div>
	`;
  let $link= document.getElementById('link');
  $link.innerHTML = '';
  $link.appendChild($csv);
                      
  let data_with_extra = get_data(d, true);
  if (window.simulation_parameters.dead_point === 0) data_with_extra.deads = null;
  draw_chart(data_with_extra.labels, 
             data_with_extra.reps, 
             data_with_extra.reviews,
             data_with_extra.deads);
}
// export
function make_csv_link(log) {
	let csv = "data:text/csv;charset=utf-8,";
  csv += "reps,reviews\r\n";
  for (let logentry of log) {
    let row = `${logentry.reps},${logentry.reviews}`
    csv += row + "\r\n"; 
  }
  let encodedUri = encodeURI(csv);
	//window.open(encodedUri);
  var link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "anki_simulation.csv");
  link.innerHTML= "Download CSV";
  return link;
}
// the stats
function max(numbers) {
	let res = null;
  for(let n of numbers) {
  	if (res === null) res = n;
    else res = Math.max(res, n);
  }    
  return res;
}
function mean(numbers) {
    var total = 0, i;
    for (i = 0; i < numbers.length; i += 1) {
        total += numbers[i];
    }
    return total / numbers.length;
}
function median(numbers) {
    // median of [3, 5, 4, 4, 1, 1, 2, 3] = 3
    var median = 0, numsLen = numbers.length;
    numbers = numbers.slice(0); // copy to avoid mutation
    numbers.sort();
 
    if (numsLen % 2 === 0) { // is even
        // average of two middle numbers
        median = (numbers[numsLen / 2 - 1] + numbers[numsLen / 2]) / 2;
    } else { // is odd
        // middle number only
        median = numbers[(numsLen - 1) / 2];
    }
 
    return median;
}
function draw_chart(labels, reps, reviews, deads=null){
  let ctx = document.getElementById("myChart").getContext('2d');
  let datasets = [
    { label: 'reps',
     fill: false,
     borderColor: window.chartColors.red,
     showLine: false,
     data: reps   },
    { label: 'reviews',
     fill: false,
     borderColor: window.chartColors.blue,
     showLine: false,
     data: reviews   }
  ]
  if (deads !== null) {
		datasets.push(
    	{label: 'deads',
       fill: false,
       borderColor: window.chartColors.grey,
       showLine: false,
       data: deads   }
    );
  }
  /* global Chart */
  if(chart !== null ) chart.destroy();
  chart = new Chart(ctx,{
    type:'line',
    data: {
      labels:labels,
      datasets: datasets
    },
    options: {
      scales: {
        xAxes: [{
          display: true,
          scaleLabel: {
            display: true,
            labelString: 'Days'
          }
        }],
        yAxes: [{
          display: true,
          scaleLabel: {
            display: true,
            labelString: 'Reps'
          }
        }]
      }
    }   
  });
  let $result = document.getElementById('result');
  $result.style.display = "block";
}
