# Svg.JS Timeline extension

The extension allows to group animations and control them. Example:
``` Javascript
const draw = SVG('drawing');
const rect = draw.rect(100, 100).move(300, 300).fill("#0f0");;
const rect2 = draw.rect(100, 100).move(400, 300).fill("#0f0");;
const myTimeline = rect.timeline()
    .animate(10000).attr('x', 200)
    .animate(5000,'>').attr('y', 200)
    .animate(5000,'<').size(50, 50)
    .onceAll(.55, function(offset) {
        console.log('55%', offset*100+'%');
    })
    .onceAll(1, function(offset) {
        console.log('100%', offset*100+'%');
    })
    .onceAll(0, function(offset) {
        console.log('0%', offset*100+'%');
    })
    .afterAll(function() {
        console.log('finished');
    })
    .duringAll(function(pos, morph) {
        rect22.move(morph(400, 0), morph(300, 0));
        if (Math.round(pos*100)===55) {
            console.log('using duringAll 55%', pos*100+'%');
        }
    });

myTimeline.pause();
setTimeout(() => {
    //rewind animation to 10%
    myTimeline.at(0.1);
    setTimeout(() => {
        myTimeline.play(0.1);
        setTimeout(() => {
            myTimeline.stop(0.1);
        }, 500);
    }, 500);
}, 1000);
```


####Parallel use

``` Javascript
// Use same property on different timeline
// expected result: second timeline will overwrite the first one

rect.timeline().animate(200).attr({x: 100});
rect.timeline().animate(2000).attr({x: 200});
```