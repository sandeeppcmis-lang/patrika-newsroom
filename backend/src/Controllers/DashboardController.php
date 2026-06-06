<?php
namespace App\Controllers;
use App\Core\Response;

class DashboardController {
    public function index(): void {
        $edition = $_GET['edition'] ?? 'Jaipur';
        // TODO: aggregate from news_content, production_logs, legal_cases, hr_alerts tables.
        Response::json([
            'edition' => $edition,
            'kpis' => ['pages' => 184, 'delayed' => 3, 'productivity' => 86, 'quality' => 'A', 'adratio' => 38, 'legal' => 7, 'hr' => 5],
            'qualityTrend' => array_map(function ($d, $s) { return ['day' => $d, 'score' => $s]; },
                ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], [78,82,80,85,88,84,90]),
            'editionDelays' => [
                ['edition'=>'Jaipur','delay'=>12],['edition'=>'Jodhpur','delay'=>45],
                ['edition'=>'Udaipur','delay'=>8],['edition'=>'Kota','delay'=>22],
                ['edition'=>'Bhopal','delay'=>5],['edition'=>'Indore','delay'=>30]],
            'deptShare' => [
                ['name'=>'Front Page','value'=>18],['name'=>'City','value'=>26],
                ['name'=>'Sports','value'=>14],['name'=>'Business','value'=>11],
                ['name'=>'Entertainment','value'=>16],['name'=>'Editorial','value'=>15]],
        ]);
    }
}
