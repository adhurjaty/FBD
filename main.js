var height = 500;
var width = 1000;
var border = 1;

var fbdHeight = 200;
var fbdWidth = 400;
var fbdBorderColor = 'steelblue';
var fbdBorder = 1;

var inputSpacing = 5;

var momentWidth = 40;
var assetWidth = 30;

var imgList = ['img/force_img2.png', 'img/moment_img.png', 'img/roller_img.png',
               'img/pin_img.png', 'img/cantilever_img.png'];
var toolList = [['force', placeForce], ['moment', moment], ['roller', rollerJoint],
                ['pin', pinJoint], ['cantilever', cantileverJoint]];
var moveFnc = {'force': moveForce, 'label': moveLabel, 'pin': movePinJoint, 'moment': moveMoment,
                       'roller': moveRollerJoint, 'cantilever': moveCantilever};
var toolSize = 50;
var toolSpacing = 5;
var toolX = width - toolSpacing - toolSize;
var toolIndex = 0;
var toolInputs = [
                  {orient: {cartesian: ['Fx: ', 'Fy: '], polar: ['Mag: ', '&theta;:']}},
                  {orient: {cartesian: null, polar: null}},
                  {orient: {cartesian: ['Fx: ', 'Fy: '], polar: ['&theta;: ']}},
                  {orient: {cartesian: null, polar: null}},
                  {orient: {cartesian: null, polar: null}},
                 ];
var toolSelectionRect = [];
var selectedWidth = 3;
var unselectedWidth = .5;
var selectedColor = 'green';

// int that is used to temporarily change the tool index and track the previous tool index for editCallback
var tempToolIndex = -1;

var toolDialog = null;
var dialogHeight = 320;
var dialogWidth = 260;
var dialogBorder = 1;
var dialogBorderColor = 'black';

var imageHeight = 100;
var imageWidth = dialogWidth - 10;
var placeholderImage = 'https://placehold.it/' + imageWidth + 'x' + imageHeight;

var fbdCoordsMax = {x: 1.0, y: 1.0, z: 1.0};

// array to keep track of all things placed on fbd
var assets = []

var resultsLabels = [];

// moment asset is special in that it never moves once placed and is only added or subtracted value
// once another moment is placed
var momentAsset = null;

var constraintMap = {
                        'force': 0,
                        'moment': 0,
                        'label': 0,
                        'roller': 1,
                        'pin': 2,
                        'cantilever': 3
                    }


var viewModel = {
    orient: ko.observable(true),
    moment: ko.observable(false),
    posInputs: ko.observableArray([ko.observable({label: 'X: ', value: ''}),
                                ko.observable({label: 'Y: ', value: ''})]),
    orientInputs: ko.observableArray([ko.observable({label: 'Fx: ', value: ''}),
                                      ko.observable({label: 'Fy: ', value: ''})]),
    dialogHeight: ko.observable(dialogHeight + 'px'),
    dialogWidth: ko.observable(dialogWidth + 'px'),
    dialogX: ko.observable('0px'),
    dialogY: ko.observable('0px'),
    dialogVisibility: ko.observable(false),
    imgSrc: ko.observable(placeholderImage),
    editObj: ko.observable(null),
    cartesian: ko.observable(true),
    calculationError: ko.observable(false),
    errorMessage: ko.observable(''),
    changeCoords: function(data, event) {
        var coords = $(event.toElement).html().toLowerCase();
        this.cartesian(coords == 'cartesian');
        this.orientInputs(toolInputs[toolIndex].orient[coords].map(function(d, i) {
            return ko.observable({label: d, value: viewModel.orientInputs()[i] == null ?
                                                '' : viewModel.orientInputs()[i]().value});
        }));
    }
}

ko.applyBindings(viewModel);


function updateArray(array, field, new_vals) {
    for(var i = 0; i < new_vals.length; i++){
        var new_val = array[i]();
        new_val[field] = new_vals[i]
        array[i](new_val);
    }
}


function interpolate(from_min, from_max, to_min, to_max, x) {
    if((from_min <= x && x <= from_max) || (from_max <= x && x <= from_min))
        return (x - from_min) * (to_max - to_min) / (from_max - from_min) + to_min;
    //throw 'Coordinate out of bounds Exception';
    console.log('Outside of FBD bounds');
}


function magnitude(x, y) {
    return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
}


function cartesianToPolar(x, y) {
    return [magnitude(x, y), Math.atan2(y, x)];
}


function polarToCartesian(mag, theta) {
    return [mag * Math.cos(theta), mag * Math.sin(theta)];
}

function svgToFbdCoords(x, y) {
    var rectX = parseInt(fbd.attr('x'));
    var rectY = parseInt(fbd.attr('y'));

    return [interpolate(rectX, rectX + fbdWidth, 0, fbdCoordsMax.x, x),
            interpolate(rectY + fbdHeight, rectY, 0, fbdCoordsMax.y, y)];
}


function fbdToSvgCoords(x, y) {
    var rectX = parseInt(fbd.attr('x'));
    var rectY = parseInt(fbd.attr('y'));

    return [interpolate(0, fbdCoordsMax.x, rectX, rectX + fbdWidth, x),
            interpolate(0, fbdCoordsMax.y, rectY + fbdHeight, rectY, y)];
}


function hideDialog() {
    if(toolDialog != null) {
        toolDialog.remove();
        toolDialog = null;
    }
    viewModel.dialogVisibility(false);
}

function cancelBtn() {
    if(tempToolIndex != -1) {
        tool(tempToolIndex);
        tempToolIndex = -1;
    }
    hideDialog();
}

function placeBtn() {
    var vecX = parseFloat(viewModel.orientInputs()[0]().value);
    var vecY = NaN;
    if(viewModel.orientInputs().length == 2)
        vecY = parseFloat(viewModel.orientInputs()[1]().value);   
    var posX = parseFloat(viewModel.posInputs()[0]().value);
    var posY = parseFloat(viewModel.posInputs()[1]().value);

    resizeFbd(posX, posY);

    if(!viewModel.cartesian()) {
        if(isNaN(vecX))
            throw 'Invalid input';

        if(toolList[toolIndex][0] == 'roller') {
            vecX *= Math.PI/180.0;        //convert to radians
            var newCoords = polarToCartesian(1, vecX);
            vecX = newCoords[0];
            vecY = newCoords[1];
        }
        if(toolList[toolIndex][0] == 'force') {
            if(isNaN(vecY))
                throw 'Invalid input';
            
            vecY *= Math.PI/180.0;        //convert to radians
            var newCoords = polarToCartesian(vecX, vecY);
            vecX = newCoords[0];
            vecY = newCoords[1];
        }
    }

    if(viewModel.editObj() == null) {
        var tempObj = {}
        tempObj[tool()[0]] = tool()[1](posX, posY, vecX, vecY);
        assets.push(tempObj);
        //assets.push({'label': placeLabel(posX, posY)})
    } else {
        var key = Object.keys(viewModel.editObj())[0]
        moveFnc[key](viewModel.editObj()[key], fbdToSvgCoords(posX, posY).concat([vecX, vecY]));

        //set the toolIndex back to the previous value
        tool(tempToolIndex);
        tempToolIndex = -1;
    }

    hideDialog();
}


function resizeFbd(x, y) {
    if(x > fbdCoordsMax.x || y > fbdCoordsMax.y) {
        fbdCoordsMax.x = Math.max(x+.1, fbdCoordsMax.x);
        fbdCoordsMax.y = Math.max(y+.1, fbdCoordsMax.y);

        for(var a of assets) {
            var assetType = Object.keys(a)[0];
            var newPos = fbdToSvgCoords(parseFloat(a[assetType].attr('absPosX')),
                                        parseFloat(a[assetType].attr('absPosY')));
            moveFnc[assetType](a[assetType], newPos);
        }

        maxLabel.text('(' + fbdCoordsMax.x + ', ' + fbdCoordsMax.y + ')');
    }
}

function tool(index) {
    //function gets (no parameter specified) and sets (index specified) which tool is selected
    if(index !== undefined) {
        if(index >= toolList.length) {
            throw 'Tool Index Out of Bounds';
        }
        
        toolSelectionRect[toolIndex].style('stroke', 'black')
                                    .style('stroke-width', unselectedWidth)
        toolIndex = index;

        toolSelectionRect[toolIndex].style('stroke', selectedColor)
                                    .style('stroke-width', selectedWidth)

        viewModel.orient(toolInputs[index].orient.cartesian != null);
        viewModel.moment(index == 1);

        return toolList[index];

    } else {
        return toolList[toolIndex];
    }

}

function toolCallback(i) {
    return function() {
        tool(i);
    }
}


function popDialog(el, index) {

    viewModel.editObj(null);
    dialogHelper(index, d3.mouse(this)[0] - 40, d3.mouse(this)[1] - 40)

    // put clicked position coords in popped dialog
    updateArray(viewModel.posInputs(), 'value', svgToFbdCoords(d3.mouse(this)[0], d3.mouse(this)[1]).map(function(d) {
        return d.toFixed(2);
    }));    
}


function editCallback(el, index) {
    return function() {
        var tempObj = {}
        tempObj[toolList[index][0]] = el;

        tempToolIndex = toolIndex;
        tool(index);

        viewModel.editObj(tempObj);
        dialogHelper(index, parseFloat(el.attr('x')), parseFloat(el.attr('y')));
        updateArray(viewModel.posInputs(), 'value', [el.attr('absPosX'), el.attr('absPosY')])
        updateArray(viewModel.orientInputs(), 'value', [el.attr('xVec'), el.attr('yVec')])
    }
}


function dialogHelper(index, x, y) {
    
    if(y + dialogHeight > height) {
        y = height - dialogHeight;
    }

    clearResultsLabels();

    createToolDialog(x, y);

    /*
    viewModel.orientInputs(toolInputs[toolIndex].orient.cartesian.map(function(d) {
        return {'label': d, 'value': ''};
    }));
    */

    var absX = x + svg.node().offsetLeft;
    var absY = y + svg.node().offsetTop;
    var inputPosX = 0;
    var inputPosY = 0;

    //Knockout.js way of moving dialog box
    viewModel.dialogVisibility(true);
    viewModel.dialogX(absX + inputPosX + 'px');
    viewModel.dialogY(absY + inputPosY + 'px');
}

function createToolDialog(x, y) {
//create the tool dialog rectangle and hide it. It only is visible when a tool is placed
    if(toolDialog != null)
        hideDialog();
    
    toolDialog = svg.append('rect')
                    .attr('x', x)
                    .attr('y', y)
                    .attr('height', dialogHeight)
                    .attr('width', dialogWidth)
                    .style('stroke', dialogBorderColor)
                    .style('stroke-width', dialogBorder)
                    .style('fill', 'white');
}


//create the svg element
var svg = d3.select('#drawing')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('border', 1);

//create the free body diagram rectangle
var fbd = svg.append('rect')
             .attr('x', (width-fbdWidth)/2)
             .attr('y', (height-fbdHeight)/2)
             .attr('height', fbdHeight)
             .attr('width', fbdWidth)
             .style('stroke', fbdBorderColor)
             .style('fill', 'transparent')
             .style('stroke-width', fbdBorder)
             .on('click', popDialog);

// create origin circle
var origin = svg.append('circle')
                .attr('cx', fbd.attr('x'))
                .attr('cy', parseInt(fbd.attr('y')) + fbdHeight)
                .attr('r', 5)
                .style('fill', 'transparent')
                .style('stroke', fbdBorderColor)
                .style('stroke-width', fbdBorder);

//create the tool selectors
for(var i=0; i < toolList.length; i++) {
    svg.append('image')
       .attr('xlink:href', imgList[i])
       .attr('x', toolX)
       .attr('y', i*toolSize + (i+1)*toolSpacing)
       .attr('height', toolSize)
       .attr('width', toolSize);

    toolSelectionRect.push(svg.append('rect')
                              .attr('x', toolX)
                              .attr('y', i*toolSize + (i+1)*toolSpacing)
                              .attr('height', toolSize)
                              .attr('width', toolSize)
                              .style('fill', 'transparent')
                              .style('stroke', i == 0 ? selectedColor : 'black')
                              .style('stroke-width', i == 0 ? selectedWidth : unselectedWidth)
                              .on('click', toolCallback(i))
                              .on('mouseover', (function(index) {
                                    return function() {
                                        var name = toolList[index][0];
                                        var name = name.charAt(0).toUpperCase() + name.slice(1);
                                        if(index > 1) {
                                            name += ' Joint';
                                        }
                                        return nhpup.popup(name);
                                        //return 'nhpup.popup("' + name + '")';
                                  }
                              })(i)));
}


//create the svg border
var borderPath = svg.append('rect')
                    .attr('x', 0)
                    .attr('y', 0)
                    .attr('height', height)
                    .attr('width', width)
                    .style('stroke', 'black')
                    .style('fill', 'none')
                    .style('stroke-width', border);


function placeForce(posX, posY, xVec, yVec) {
    if(![posX, posY, xVec, yVec].every(function(d) { return !isNaN(d); })) {
        throw 'Show Error';
    }
    var force = jointHelper(posX, posY, xVec, yVec, 0);
    force.attr('xVec', xVec).attr('yVec', yVec);
    return force;
}


function moveForce(force, newPos) {
    moveHelper(force, newPos);
}


function placeLabel(x, y) {
    // places a coordinate label under specified location
    // x and y given in fbd coords
    var text =  '(' + x + ', ' + y + ')';
    var coords = fbdToSvgCoords(x, y);
    //offset of label is above point if in top half of fbd
    var offset = y < fbdCoordsMax.y/2 ? 20 : -10;
    
    return svg.append('text')
              .text(text)
              .attr('x', coords[0])
              .attr('y', coords[1] + offset)
              .attr('absPosX', x)
              .attr('absPosY', y)
              .attr('text-anchor', 'middle');
}


function placeResultLabel(x, y, text) {

    var label = svg.append('text')
              .text(text)
              .attr('x', x)
              .attr('y', y)
              .attr('text-anchor', 'middle');

    resultsLabels.push({'label': label})
    return label;
}


function moveLabel(label, newPos) {
    label.attr('x', newPos[0])
         .attr('y', newPos[1]);
}


function clearResultsLabels() {
    if(resultsLabels.length == 0) {
        return;
    }

    resultsLabels.forEach(function(a, i) {
        a[Object.keys(a)[0]].remove();
    });
    resultsLabels = [];
}


function moment(n1, n2, mag) {
    // n1 and n2 are unused parameters there only to make the function call in 'placeBtn' work

    if(momentAsset == null) {
        var pos = fbdToSvgCoords(fbdCoordsMax.x/2, fbdCoordsMax.y/2).map(function(d, i) {
            return d - momentWidth/2;
        });
        momentAsset = svg.append('image')
                         .attr('xlink:href', imgList[1])
                         .attr('x', pos[0])
                         .attr('y', pos[1])
                         .attr('height', momentWidth)
                         .attr('width', momentWidth)
                         .attr('xVec', mag)
        momentAsset.on('click', editCallback(momentAsset, 1));
        
    } else
        momentAsset.attr('xVec', mag + parseFloat(momentAsset.attr('xVec')))

    momentAsset.attr('transform', '');
    if(parseFloat(momentAsset.attr('xVec')) < 0) {
        momentAsset.attr('transform', 'scale(-1,1) translate(' +
                        (-momentWidth - 2*parseFloat(momentAsset.attr('x'))) + ',0)');
    }
    
}

function moveMoment(moment, magArray) {
    var mag = magArray[2];
    moment.attr('transform', '');

    moment.attr('xVec', mag);
    if(mag < 0) {
        moment.attr('transform', 'scale(-1,1) translate(' +
                        (-momentWidth - 2*parseFloat(moment.attr('x'))) + ',0)');
    }
}


function pinJoint(posX, posY) {
    if(![posX, posY].every(function(d) { return !isNaN(d); })) {
        throw 'Show Error';
    }
    return jointHelper(posX, posY, 0, 1, 3);
}


function movePinJoint(joint, newPos) {
    moveHelper(joint, newPos);
}


function rollerJoint(posX, posY, xVec, yVec) {
    if(![posX, posY, xVec, yVec].every(function(d) { return !isNaN(d); })) {
        throw 'Show Error';
    }
    var joint = jointHelper(posX, posY, xVec, yVec, 2);
    joint.attr('xVec', xVec).attr('yVec', yVec);
    return joint;
}


function moveRollerJoint(joint, newPos) {
    moveHelper(joint, newPos);
}


function cantileverJoint(posX, posY) {
    if(![posX, posY].every(function(d) { return !isNaN(d); })) {
        throw 'Show Error';
    }
    return jointHelper(posX, posY, 0, 1, 4);
}


function moveCantilever(joint, newPos) {
    moveHelper(joint, newPos);
}


function jointHelper(posX, posY, xVec, yVec, index) {
    var theta = Math.atan2(yVec, xVec) * 180/Math.PI;

    var pos = fbdToSvgCoords(posX, posY);

    var joint = svg.append('image')
              .attr('xlink:href', imgList[index])
              .attr('x', pos[0] - assetWidth/2)
              .attr('y', pos[1])
              .attr('height', assetWidth)
              .attr('width', assetWidth)
              .attr('absPosX', posX)
              .attr('absPosY', posY);
    rotateImage(joint, pos, theta);
    joint.on('click', editCallback(joint, index));
    return joint;
}


function moveHelper(joint, newPos) {
    joint.attr('x', newPos[0] - parseFloat(joint.attr('width'))/2)
         .attr('y', newPos[1]);
    if(newPos.length == 4) {
        rotateImage(joint, newPos.slice(0, 2), Math.atan2(newPos[3], newPos[2]) * 180/Math.PI);
        joint.attr('xVec', newPos[2]).attr('yVec', newPos[3]);
    } else if(joint.attr('transform') != null) {
        joint.attr('transform', [joint.attr('transform').split(',')[0]].concat(newPos).join(',') + ')');
    }
}

function rotateImage(imageEl, origin, theta) {
    imageEl.attr('transform', 'rotate(' + (90 - theta) + ',' + origin[0] + ',' + origin[1] + ')');
}


function calculateForces() {
    //sum DOF constraints from joints
    var constraints = assets.reduce(function(prev, curr) {
        return prev + constraintMap[Object.keys(curr)[0]];
    }, 0);

    viewModel.calculationError(false);
    clearResultsLabels();

    if(constraints != 3) {
        viewModel.calculationError(true);
        viewModel.errorMessage(constraints < 3 ? 'Under-constrained Model' : 'Over-constrained Model')
        return;
    }
    
    var forceVec = Array.apply(null, Array(3)).map(function() { return [0]; });
    var equationMatrix = Array.apply(null, Array(3)).map(function() {
        return Array.apply(null, Array(3)).map(function() { return 0; });
    });
    var outVars = [];
    var uniqueJoint = [];

    for(var a of assets) {
        var key = Object.keys(a)[0];

        a[key].attr('result', '');

        switch(key) {
            case 'force':
                forceVec[0][0] -= parseFloat(a[key].attr('xVec'));
                forceVec[1][0] -= parseFloat(a[key].attr('yVec'));
                forceVec[2][0] -= -parseFloat(a[key].attr('xVec')) * parseFloat(a[key].attr('absPosY')) +
                                  parseFloat(a[key].attr('yVec')) * parseFloat(a[key].attr('absPosX'))
                break;
            case 'pin':
                equationMatrix[0][outVars.length] += 1;
                equationMatrix[1][outVars.length + 1] += 1;
                equationMatrix[2][outVars.length] -= parseFloat(a[key].attr('absPosY'));
                equationMatrix[2][outVars.length + 1] += parseFloat(a[key].attr('absPosX'));
                ['',''].forEach(function(d) { outVars.push(a[key]); })
                uniqueJoint.push(a[key]);
                break;
            case 'roller':
                equationMatrix[0][outVars.length] += parseFloat(a[key].attr('xVec'));
                equationMatrix[1][outVars.length] += parseFloat(a[key].attr('yVec'));
                equationMatrix[2][outVars.length] -= parseFloat(a[key].attr('absPosY')) * parseFloat(a[key].attr('xVec'));
                equationMatrix[2][outVars.length] += parseFloat(a[key].attr('absPosX')) * parseFloat(a[key].attr('yVec'));
                outVars.push(a[key])
                uniqueJoint.push(a[key]);
                break;
            case 'cantilever':
                equationMatrix = math.eye(3);
                ['','',''].forEach(function(d) { outVars.push(a[key]); })
                uniqueJoint.push(a[key]);
                break;
            default:
                console.log(a);
                break;
        }
    }

    forceVec[2][0] -= momentAsset != null ? parseFloat(momentAsset.attr('xVec')) : 0;

    forceVec = math.matrix(forceVec);
    equationMatrix = math.matrix(equationMatrix);

    result = math.multiply(math.inv(equationMatrix), forceVec);
    for(var i=0; i<3; i++) {
        outVars[i].attr('result', outVars[i].attr('result') + result._data[i][0].toFixed(2) + ', ');
    }
    
    uniqueJoint.forEach(function(d) {
        var x = parseInt(d.attr('x')) + assetWidth/2;
        var y = parseInt(d.attr('y')) + assetWidth + 15;
        placeResultLabel(x, y, '(' + d.attr('result').slice(0, -2) + ')');
    });
}


function deleteItem() {
    var key = Object.keys(viewModel.editObj())[0];

    //remove object from assets list
    for(var i=0; i<assets.length; i++) {
        if(assets[i][key] == viewModel.editObj()[key]) {
            assets = assets.slice(0, i).concat(assets.slice(i+1));
            break;
        }
    }

    viewModel.editObj()[key].remove();
    hideDialog();
    tool(tempToolIndex);
    tempToolIndex = -1;
}


function clearAssets() {
    for(var a of assets) {
        var key = Object.keys(a)[0];
        a[key].remove();
    }

    assets = [];

    if(momentAsset != null) {
        momentAsset.remove();
        momentAsset = null;
    }

}


function printMatrix(matrix) {
    matrix._data.forEach(function(arr) {
        console.log(arr);
    });
}

function testCalc() {
    tool(0);
    viewModel.orientInputs()[0]().value = 20;
    viewModel.orientInputs()[1]().value = 0;   
    viewModel.posInputs()[0]().value = 0;
    viewModel.posInputs()[1]().value = .75;
    placeBtn();

    viewModel.orientInputs()[0]().value = 0;
    viewModel.orientInputs()[1]().value = -20;   
    viewModel.posInputs()[0]().value = .9;
    viewModel.posInputs()[1]().value = 1.0;
    placeBtn();

    tool(2);
    viewModel.orientInputs()[0]().value = 0;
    viewModel.orientInputs()[1]().value = 1;   
    viewModel.posInputs()[0]().value = 1.0;
    viewModel.posInputs()[1]().value = 0;
    placeBtn();

    tool(3);  
    viewModel.posInputs()[0]().value = .1;
    viewModel.posInputs()[1]().value = 0;
    placeBtn();
}

var originLabel = placeLabel(0,0);
var maxLabel = placeLabel(1,1);
//calculateForces();
testCalc();