var SIM = SIM || {}

SIM.STATS = {

    init: function () {
        var view = this;
        view.variables();
        view.events();
    },

    variables: function () {
        var view = this;
        view.body = $('body');
        view.stats = view.body.find('section.stats');
        view.dmg = view.stats.find('.container-dmg canvas');
        view.dmglegend = view.stats.find('.container-dmg .legend');
        view.aura = view.stats.find('.container-aura canvas');
        view.colors = ['#003f5c', '#2f4b7c', '#665191', '#a05195', '#d45087', '#f95d6a', '#ff7c43', '#ffa600'];
        view.close = view.stats.find('.btn-close');
        view.table = view.stats.find('.container-table table');
    },

    events: function () {
        var view = this;

        view.close.click(function (e) {
            e.preventDefault();
            $('.js-stats').removeClass('active');
            $('section.stats').removeClass('active');
        });
    },

    initCharts: function (sim) {
        var view = this;
        $('.js-stats').removeClass('disabled');
        view.buildTable(sim);
        view.buildData(sim);
        view.buildCharts();
    },

    buildData: function (sim) {
        var view = this;

        // Auras
        let counter = 0;
        let data = [];
        let colors = [];
        view.auradata = {
            labels: [],
            datasets: []
        };
        for (let name in sim.player.auras) {
            let aura = sim.player.auras[name];
            if (!aura.uptime) continue;
            view.auradata.labels.push(aura.name);
            data.push((aura.uptime / sim.iterations / sim.duration / 10).toFixed(2));
            colors.push(view.colors[counter % view.colors.length]);
            counter++;
        }
        view.auradata.datasets.push({
            data: data,
            fill: false,
            backgroundColor: colors,
        });

        // Damage
        counter = 0;
        data = [];
        colors = [];
        view.dmgdata = {
            labels: [],
            datasets: []
        };
        for (let name in sim.player.spells) {
            let spell = sim.player.spells[name];
            if (!spell.totaldmg) continue;
            view.dmgdata.labels.push(spell.constructor.name);
            data.push((spell.totaldmg / sim.iterations / sim.duration).toFixed(2));
            colors.push(view.colors[counter % view.colors.length]);
            counter++;
        }

        // MH
        view.dmgdata.labels.push('Main Hand');
        data.push((sim.player.mh.totaldmg / sim.iterations / sim.duration).toFixed(2));
        colors.push(view.colors[counter % view.colors.length]);
        counter++;
        if (sim.player.mh.totalprocdmg) {
            view.dmgdata.labels.push('Main Hand Proc');
            data.push((sim.player.mh.totalprocdmg / sim.iterations / sim.duration).toFixed(2));
            colors.push(view.colors[counter % view.colors.length]);
            counter++;
        }

        // OH
        view.dmgdata.labels.push('Off Hand');
        data.push((sim.player.oh.totaldmg / sim.iterations / sim.duration).toFixed(2));
        colors.push(view.colors[counter % view.colors.length]);
        counter++;
        if (sim.player.oh.totalprocdmg) {
            view.dmgdata.labels.push('Off Hand Proc');
            data.push((sim.player.oh.totalprocdmg / sim.iterations / sim.duration).toFixed(2));
            colors.push(view.colors[counter % view.colors.length]);
            counter++;
        }

        view.dmgdata.datasets.push({
            data: data,
            fill: false,
            backgroundColor: colors,
        });

    },

    buildCharts: function () {
        var view = this;

        // Auras
        if (view.aurachart) view.aurachart.destroy();
        view.aurachart = new Chart(view.aura, {
            type: 'horizontalBar',
            data: view.auradata,
            showTooltips: false,
            options: {
                responsive: true,
                legend: {
                    display: false,
                    align: 'center',
                    fullWidth: true
                },
                tooltips: {
                    enabled: false,
                    callbacks: {
                        label: (item) => ` ${item.xLabel}%`,
                    },
                },
                hover: {
                    mode: null
                },
                title: {
                    display: true,
                    text: 'Aura Uptime',
                    fontColor: '#ccc',
                },
                scales: {
                    yAxes: [{
                        ticks: {
                            fontColor: '#ccc',
                        },
                        gridLines: {
                            display: false
                        }
                    }],
                    xAxes: [{
                        ticks: {
                            beginAtZero: true,
                            min: 0,
                            display: false,
                        },
                        gridLines: {
                            display: false
                        }
                    }]
                },
                animation: {
                    onComplete: function () {
                        var chartInstance = this.chart;
                        var ctx = this.chart.ctx;
                        this.data.datasets.forEach(function (dataset, i) {
                            var meta = chartInstance.controller.getDatasetMeta(i);
                            meta.data.forEach(function (bar, index) {
                                var data = dataset.data[index];
                                ctx.fillStyle = "#ccc";
                                ctx.fillText(data + '%', bar._model.x - 50, bar._model.y + 5);
                            });
                        });
                    }
                }
            },

        });

        // Damage
        if (view.dmgchart) view.dmgchart.destroy();
        view.dmgchart = new Chart(view.dmg, {
            type: 'doughnut',
            data: view.dmgdata,
            options: {
                elements: {
                    arc: {
                        borderWidth: 1,
                    }
                },
                responsive: true,
                title: {
                    display: true,
                    text: 'DPS',
                    fontColor: '#ccc',
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                },
                legend: {
                    display: false
                },
            }
        });

        // view.dmglegend.html(view.dmgchart.generateLegend());
        // let lis = view.dmglegend.find('li');
        // for(let i = 0; i < lis.length; i++) {
        //     let value = view.dmgdata.datasets[0].data[i];
        //     lis.eq(i).append(`<em>${value}</em>`);
        // }
    },

    buildTable: function (sim) {
        var view = this;
        view.table.empty();
        view.table.append('<thead><tr><th>Spell</th><th>Hit %</th><th>Crit %</th><th>Miss %</th><th>Dodge %</th><th>Glance %</th><th>Uses</th><th>DPS</th></tr></thead><tbody>');


        let i = sim.iterations;
        let data = sim.player.mh.data;
        let total = data.reduce((a, b) => a + b, 0);
        let dps = (sim.player.mh.totaldmg / sim.iterations / sim.duration).toFixed(2);
        view.table.append(`<tr><td>Main Hand</td><td>${(data[0] / total * 100).toFixed(2)}</td><td>${(data[3] / total * 100).toFixed(2)}</td><td>${(data[1] / total * 100).toFixed(2)}</td><td>${(data[2] / total * 100).toFixed(2)}</td><td>${(data[4] / total * 100).toFixed(2)}</td><td>${(total / i).toFixed(2)}</td><td>${dps}</td></tr>`);

        data = sim.player.oh.data;
        total = data.reduce((a, b) => a + b, 0);
        dps = (sim.player.oh.totaldmg / sim.iterations / sim.duration).toFixed(2);
        view.table.append(`<tr><td>Off Hand</td><td>${(data[0] / total * 100).toFixed(2)}</td><td>${(data[3] / total * 100).toFixed(2)}</td><td>${(data[1] / total * 100).toFixed(2)}</td><td>${(data[2] / total * 100).toFixed(2)}</td><td>${(data[4] / total * 100).toFixed(2)}</td><td>${(total / i).toFixed(2)}</td><td>${dps}</td></tr>`);

        for (let name in sim.player.spells) {
            let n = sim.player.spells[name].constructor.name
            let data = sim.player.spells[name].data;
            let total = data.reduce((a, b) => a + b, 0);
            if (!total) continue;
            let dps = (sim.player.spells[name].totaldmg / sim.iterations / sim.duration).toFixed(2);
            view.table.append(`<tr><td>${n}</td><td>${(data[0] / total * 100).toFixed(2)}</td><td>${(data[3] / total * 100).toFixed(2)}</td><td>${(data[1] / total * 100).toFixed(2)}</td><td>${(data[2] / total * 100).toFixed(2)}</td><td>${(data[4] / total * 100).toFixed(2)}</td><td>${(total / i).toFixed(2)}</td><td>${dps}</td></tr>`);
        }

        view.table.append('</tbody>');

        view.table.tablesorter({
            widthFixed: true,
        });

    }



};
