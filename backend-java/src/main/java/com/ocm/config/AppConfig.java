package com.ocm.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * Central application configuration.
 * Transaction management is enabled so @Transactional in controllers works.
 */
@Configuration
@EnableTransactionManagement
public class AppConfig {
    // JdbcTemplate and DataSource are auto-configured by spring-boot-starter-jdbc.
    // This class just enables declarative transactions.
}
